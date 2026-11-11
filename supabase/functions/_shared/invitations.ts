import { appOrigin } from "./app-url.ts";
import { RPCS, TABLES } from "./database.constants.ts";
import { invitationEmail, sendEmail } from "./email.ts";
import { AppError } from "./errors.ts";
import { generateLinkCode, hashLinkCode, linkWithCode } from "./link-code.ts";
import type { EdgeContext } from "./types.ts";

// Invitaciones de estudiantes: el administrador fija correo, periodo de acceso
// y, opcionalmente, el grupo (profesor); el estudiante completa sus datos desde
// el link. La institución siempre sale del grupo.

export const INVITATION_TTL_DAYS = 7;
export const INVITATION_PATH = "/estudiante/invitacion";

const INVITATION_COLUMNS =
  "id,email,college_id,teacher_id,access_valid_from,access_valid_until,expires_at,created_at,college:colleges(name),teacher:profiles!student_invitations_teacher_id_fkey(full_name)";

export interface InvitationInput {
  email: string;
  /** Grupo fijado por el administrador; null si lo elige el estudiante. */
  teacher_id?: string | null;
  /** Solo para invitaciones antiguas creadas antes de elegir grupo. */
  college_id?: string | null;
  access_valid_from: string;
  access_valid_until: string;
}

export interface Invitation {
  id: string;
  email: string;
  college_id: string | null;
  college_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  access_valid_from: string;
  access_valid_until: string;
  expires_at: string;
  created_at: string;
}

export interface InvitationGroup {
  teacher_id: string | null;
  teacher_name: string | null;
  college_id: string | null;
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

/**
 * Resuelve la institución de una invitación. Si el administrador fijó un grupo,
 * la institución sale de ese profesor (y debe seguir siendo elegible). Si la
 * invitación es antigua y solo tiene institución, se conserva. Sin ninguno de
 * los dos, el estudiante elegirá su grupo al aceptar.
 */
export async function resolveInvitationGroup(
  context: EdgeContext,
  teacherId?: string | null,
  collegeId?: string | null,
): Promise<InvitationGroup> {
  if (teacherId) {
    const { data, error } = await context.supabaseAdmin.rpc(
      RPCS.registrationTeachers,
    );
    if (error) {
      throw new AppError(500, "teachers_lookup_failed", error.message);
    }
    const teacher = (data ?? []).find((item) => item.teacher_id === teacherId);
    if (!teacher) {
      throw new AppError(
        400,
        "invalid_teacher",
        "Select an active teacher with courses.",
        { field: "teacher_id" },
      );
    }
    return {
      teacher_id: teacher.teacher_id,
      teacher_name: teacher.teacher_name,
      college_id: teacher.college_id,
      college_name: teacher.college_name,
    };
  }
  if (collegeId) {
    const collegeName = await activeCollegeName(context, collegeId);
    return {
      teacher_id: null,
      teacher_name: null,
      college_id: collegeId,
      college_name: collegeName,
    };
  }
  return {
    teacher_id: null,
    teacher_name: null,
    college_id: null,
    college_name: null,
  };
}

type InvitationRow = Omit<Invitation, "college_name" | "teacher_name"> & {
  college: { name: string } | null;
  teacher: { full_name: string } | null;
};

function toInvitation(
  { college, teacher, ...row }: InvitationRow,
): Invitation {
  return {
    ...row,
    college_name: college?.name ?? null,
    teacher_name: teacher?.full_name ?? null,
  };
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
  const group = await resolveInvitationGroup(
    context,
    input.teacher_id,
    input.college_id,
  );
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
      email: input.email,
      teacher_id: group.teacher_id,
      college_id: group.college_id,
      access_valid_from: input.access_valid_from,
      access_valid_until: input.access_valid_until,
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
        {
          teacher_name: group.teacher_name,
          college_name: group.college_name,
        },
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
    .select(
      "email,teacher_id,college_id,access_valid_until,code_hash,expires_at,college:colleges(name),teacher:profiles!student_invitations_teacher_id_fkey(full_name)",
    )
    .eq("id", invitationId)
    .maybeSingle();
  if (previousError) {
    throw new AppError(500, "invitation_failed", previousError.message);
  }
  if (!previous) {
    throw new AppError(404, "invitation_not_found", "Invitation not found.");
  }
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
        {
          teacher_name: previous.teacher?.full_name,
          college_name: previous.college?.name,
        },
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
