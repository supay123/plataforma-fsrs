import { RPCS } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { invalidInvitation } from "../_shared/invitations.ts";
import { freeUserCode } from "../_shared/registration-activation.ts";
import {
  parseNewPassword,
  parseStudentProfile,
} from "../_shared/registration.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { optionalUuid } from "../_shared/validation.ts";
import type { AcceptInvitationBody } from "./interfaces.ts";
import { findValidInvitation } from "./find-invitation.ts";

const CODE_ATTEMPTS = 3;

/** Traduce los errores de la RPC a la respuesta que espera el formulario. */
function invitationFailure(error: {
  message?: string;
  code?: string;
}): AppError {
  const message = error.message ?? "";
  if (message.includes("invalid_invitation")) return invalidInvitation();
  if (message.includes("teacher_required")) {
    return new AppError(
      400,
      "teacher_required",
      "Select your group.",
      { field: "teacher_id" },
    );
  }
  if (message.includes("invalid_teacher")) {
    return new AppError(
      400,
      "invalid_teacher",
      "Select a valid group.",
      { field: "teacher_id" },
    );
  }
  if (message.includes("profiles_email_unique_ci")) {
    return new AppError(
      409,
      "email_taken",
      "The email already has an account.",
    );
  }
  return new AppError(
    500,
    "invitation_failed",
    message || "Unable to create the account.",
  );
}

/**
 * POST /student-invitation
 * El estudiante completa sus datos y crea su cuenta con el correo y el periodo
 * que fijó el administrador. El grupo lo fija el administrador o lo elige el
 * estudiante; la institución y los cursos salen de ese profesor. La RPC consume
 * la invitación, crea el perfil y matricula al estudiante en una sola
 * transacción.
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
  const chosenTeacherId = optionalUuid(body.teacher_id, "teacher_id");

  // Si la invitación no trae grupo, el estudiante debe elegir uno.
  if (!invitation.teacher_id && !chosenTeacherId) {
    throw new AppError(
      400,
      "teacher_required",
      "Select your group.",
      { field: "teacher_id" },
    );
  }

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

  const { data: created, error: createError } = await context.supabaseAdmin
    .auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      app_metadata: { role: "student" },
    });
  if (createError || !created.user) {
    throw new AppError(
      400,
      "auth_user_creation_failed",
      createError?.message ?? "Unable to create user.",
    );
  }

  let lastError: { message: string; code?: string } | null = null;
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const { error } = await context.supabaseAdmin.rpc(
      RPCS.acceptStudentInvitation,
      {
        p_invitation_id: invitation.id,
        p_user_id: created.user.id,
        p_teacher_id: invitation.teacher_id ?? chosenTeacherId,
        p_user_code: await freeUserCode(
          context.supabaseAdmin,
          invitation.email,
        ),
        p_given_names: profile.given_names,
        p_family_names: profile.family_names,
        p_email: invitation.email,
        p_phone: profile.phone,
        p_identity_document_type: profile.identity_document_type,
        p_identity_document_number: profile.identity_document_number,
      },
    );
    if (!error) return json({ status: "accepted" }, 201);
    lastError = error;
    // Solo se reintenta si otro perfil tomó el mismo código a la vez.
    if (error.code !== "23505") break;
  }

  await context.supabaseAdmin.auth.admin.deleteUser(created.user.id);
  throw invitationFailure(lastError ?? {});
}
