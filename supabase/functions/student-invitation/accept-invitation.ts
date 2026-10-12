import { RPCS, TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { invalidInvitation } from "../_shared/invitations.ts";
import { freeUserCode } from "../_shared/registration-activation.ts";
import {
  parseNewPassword,
  parseStudentProfile,
} from "../_shared/registration.ts";
import type { EdgeContext } from "../_shared/types.ts";
import type { AcceptInvitationBody } from "./interfaces.ts";
import { findValidInvitation } from "./find-invitation.ts";

const CODE_ATTEMPTS = 3;

/**
 * POST /student-invitation
 * El estudiante completa sus datos y crea su cuenta con el correo, la
 * institución y el periodo que fijó el administrador. El link se borra al
 * usarse; si algo falla, se restaura para poder intentarlo otra vez.
 */
export async function acceptInvitation(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<AcceptInvitationBody>(request);
  // Primero los datos: si algo no es válido, el link sigue sirviendo.
  const profile = parseStudentProfile(body as Record<string, unknown>);
  const password = parseNewPassword(body.password);
  if (body.accepted_terms !== true) {
    throw new AppError(
      400,
      "validation_error",
      "The terms and privacy policy must be accepted.",
      { field: "accepted_terms" },
    );
  }
  const invitation = await findValidInvitation(context, body.code);

  const { data: inUse, error: inUseError } = await context.supabaseAdmin.rpc(
    RPCS.emailInUse,
    { p_email: invitation.email },
  );
  if (inUseError) {
    throw new AppError(500, "email_lookup_failed", inUseError.message);
  }
  if (inUse) {
    throw new AppError(409, "email_taken", "The email already has an account.");
  }

  // Se consume borrando la fila; si llegan dos pedidos a la vez, solo uno la
  // encuentra.
  const { data: consumed, error: consumeError } = await context.supabaseAdmin
    .from(TABLES.studentInvitations)
    .delete()
    .eq("id", invitation.id)
    .select(
      "id,email,college_id,access_valid_from,access_valid_until,code_hash,expires_at,invited_by,created_at",
    )
    .maybeSingle();
  if (consumeError) {
    throw new AppError(500, "invitation_failed", consumeError.message);
  }
  if (!consumed) throw invalidInvitation();
  const restoreInvitation = () =>
    context.supabaseAdmin.from(TABLES.studentInvitations).insert(consumed);

  const { data: created, error: createError } = await context.supabaseAdmin
    .auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      app_metadata: { role: "student" },
    });
  if (createError || !created.user) {
    await restoreInvitation();
    throw new AppError(
      400,
      "auth_user_creation_failed",
      createError?.message ?? "Unable to create user.",
    );
  }

  let lastError: { message: string; code?: string } | null = null;
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const { error } = await context.supabaseAdmin.from(TABLES.profiles).insert({
      id: created.user.id,
      college_id: invitation.college_id,
      role: "student",
      user_code: await freeUserCode(context.supabaseAdmin, invitation.email),
      // El trigger de profiles compone full_name con nombres y apellidos.
      full_name: `${profile.given_names} ${profile.family_names}`,
      ...profile,
      email: invitation.email,
      is_active: true,
      access_valid_from: invitation.access_valid_from,
      access_valid_until: invitation.access_valid_until,
      created_by: invitation.invited_by,
    });
    if (!error) {
      const { error: auditError } = await context.supabaseAdmin
        .from(TABLES.auditLogs)
        .insert({
          actor_user_id: created.user.id,
          college_id: invitation.college_id,
          action: "invitation.accepted",
          entity_type: "profile",
          entity_id: created.user.id,
          metadata: {},
        });
      if (auditError) console.error("Audit log insert failed", auditError);
      return json({ status: "accepted" }, 201);
    }
    lastError = error;
    // Solo se reintenta si otra cuenta tomó el mismo código a la vez.
    if (error.code !== "23505") break;
  }

  await context.supabaseAdmin.auth.admin.deleteUser(created.user.id);
  await restoreInvitation();
  throw new AppError(
    500,
    "invitation_failed",
    lastError?.message ?? "Unable to create the account.",
  );
}
