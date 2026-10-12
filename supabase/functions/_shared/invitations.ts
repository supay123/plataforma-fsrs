import { appOrigin } from "./app-url.ts";
import { TABLES } from "./database.constants.ts";
import { invitationEmail, sendEmail } from "./email.ts";
import { AppError } from "./errors.ts";
import { generateLinkCode, hashLinkCode, linkWithCode } from "./link-code.ts";
import type { EdgeContext } from "./types.ts";

// Invitaciones de estudiantes: el administrador fija correo, institución y
// periodo de acceso, y el estudiante completa sus datos desde el link.

export const INVITATION_TTL_DAYS = 7;
export const INVITATION_PATH = "/estudiante/invitacion";

const INVITATION_COLUMNS =
  "id,email,college_id,access_valid_from,access_valid_until,expires_at,created_at,college:colleges(name)";

export interface InvitationInput {
  email: string;
  college_id: string;
  access_valid_from: string;
  access_valid_until: string;
}

export interface Invitation extends InvitationInput {
  id: string;
  expires_at: string;
  created_at: string;
  college_name: string | null;
}

/**
 * El link vence a los INVITATION_TTL_DAYS días, pero nunca después del último
 * día de acceso (al final de ese día en Lima).
 */
export function invitationExpiry(
  accessValidUntil: string,
  now = new Date(),
): Date {
  const afterTtl = new Date(now.getTime() + INVITATION_TTL_DAYS * 86_400_000);
  const lastAccessMoment = new Date(`${accessValidUntil}T23:59:59.999-05:00`);
  return afterTtl < lastAccessMoment ? afterTtl : lastAccessMoment;
}

export function invitationLink(origin: string, code: string): string {
  return linkWithCode(origin, INVITATION_PATH, code);
}

export function invalidInvitation(): AppError {
  return new AppError(
    404,
    "invalid_invitation",
    "The invitation is not valid or has expired.",
  );
}

async function activeCollegeName(
  context: EdgeContext,
  collegeId: string,
): Promise<string> {
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.colleges)
    .select("name,is_active")
    .eq("id", collegeId)
    .maybeSingle();
  if (error || !data?.is_active) {
    throw new AppError(400, "invalid_college", "Select an active college.", {
      field: "college_id",
    });
  }
  return data.name;
}

type InvitationRow = Omit<Invitation, "college_name"> & {
  college: { name: string } | null;
};

function toInvitation({ college, ...row }: InvitationRow): Invitation {
  return { ...row, college_name: college?.name ?? null };
}

export async function listInvitations(
  context: EdgeContext,
): Promise<Invitation[]> {
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.studentInvitations)
    .select(INVITATION_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new AppError(500, "invitation_lookup_failed", error.message);
  return (data as InvitationRow[]).map(toInvitation);
}

/**
 * Guarda una invitación nueva (reemplaza la anterior del mismo correo, cuyo
 * link deja de servir) y la envía. Si el correo no sale, no queda guardada.
 */
export async function createInvitation(
  request: Request,
  context: EdgeContext,
  input: InvitationInput,
  invitedBy: string,
): Promise<Invitation> {
  const collegeName = await activeCollegeName(context, input.college_id);
  const code = generateLinkCode();
  const expiresAt = invitationExpiry(input.access_valid_until).toISOString();

  const { error: deleteError } = await context.supabaseAdmin
    .from(TABLES.studentInvitations)
    .delete()
    .eq("email", input.email);
  if (deleteError) {
    throw new AppError(500, "invitation_failed", deleteError.message);
  }
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.studentInvitations)
    .insert({
      ...input,
      code_hash: await hashLinkCode(code),
      expires_at: expiresAt,
      invited_by: invitedBy,
    })
    .select(INVITATION_COLUMNS)
    .single();
  if (error) throw new AppError(500, "invitation_failed", error.message);

  try {
    await sendEmail(
      invitationEmail(
        input.email,
        collegeName,
        invitationLink(appOrigin(request), code),
        expiresAt,
      ),
    );
  } catch (sendError) {
    await context.supabaseAdmin
      .from(TABLES.studentInvitations)
      .delete()
      .eq("id", data.id);
    throw sendError;
  }
  return toInvitation(data as InvitationRow);
}

/**
 * Envía la invitación otra vez con un link nuevo (el anterior deja de servir)
 * y renueva su vigencia. Si el correo no sale, el link anterior se conserva.
 */
export async function resendInvitation(
  request: Request,
  context: EdgeContext,
  invitationId: string,
): Promise<Invitation> {
  const { data: previous, error: previousError } = await context.supabaseAdmin
    .from(TABLES.studentInvitations)
    .select("email,college_id,access_valid_until,code_hash,expires_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (previousError) {
    throw new AppError(500, "invitation_failed", previousError.message);
  }
  if (!previous) {
    throw new AppError(404, "invitation_not_found", "Invitation not found.");
  }
  const collegeName = await activeCollegeName(context, previous.college_id);
  const expiresAt = invitationExpiry(previous.access_valid_until);
  if (expiresAt <= new Date()) {
    throw new AppError(
      409,
      "invitation_access_ended",
      "The access period already ended. Cancel it and invite again.",
    );
  }

  const code = generateLinkCode();
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.studentInvitations)
    .update({
      code_hash: await hashLinkCode(code),
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", invitationId)
    .select(INVITATION_COLUMNS)
    .single();
  if (error) throw new AppError(500, "invitation_failed", error.message);

  try {
    await sendEmail(
      invitationEmail(
        previous.email,
        collegeName,
        invitationLink(appOrigin(request), code),
        expiresAt.toISOString(),
      ),
    );
  } catch (sendError) {
    await context.supabaseAdmin
      .from(TABLES.studentInvitations)
      .update({
        code_hash: previous.code_hash,
        expires_at: previous.expires_at,
      })
      .eq("id", invitationId);
    throw sendError;
  }
  return toInvitation(data as InvitationRow);
}
