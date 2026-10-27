import { writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { sendPasswordResetLink } from "../_shared/password-reset-link.ts";
import { maskEmail } from "../_shared/registration.ts";
import { loadStudentProfile } from "../_shared/student-profile.ts";
import type { EdgeContext } from "../_shared/types.ts";
import type { StudentPasswordResetBody } from "./interfaces.ts";
import { requireStudent } from "./student.ts";

/**
 * POST /admin-student-account/password-reset
 * Envía al correo del estudiante el mismo link que puede pedir él desde su
 * perfil. El link vence en 1 hora y pedir otro invalida el anterior.
 */
export async function requestStudentPasswordReset(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<StudentPasswordResetBody>(request);
  const { admin, studentId, fullName } = await requireStudent(
    context,
    body.user_id,
  );
  const { email, given_names } = await loadStudentProfile(context, studentId);
  if (!email) {
    throw new AppError(
      409,
      "student_email_required",
      "The student has no email to send the link to.",
    );
  }

  const sent = await sendPasswordResetLink(request, context, {
    userId: studentId,
    email,
    name: given_names ?? fullName,
  });
  await writeAudit(
    context,
    admin,
    "user.password_reset_requested",
    "profile",
    studentId,
  );
  return json({ email: maskEmail(email), ...sent });
}

/**
 * DELETE /admin-student-account/password-reset?user_id=...
 * Anula el link enviado al estudiante: se borra y deja de servir.
 */
export async function cancelStudentPasswordReset(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const userId = new URL(request.url).searchParams.get("user_id");
  const { admin, studentId } = await requireStudent(context, userId);
  const { error } = await context.supabaseAdmin
    .from(TABLES.passwordResetCodes)
    .delete()
    .eq("user_id", studentId);
  if (error) throw new AppError(500, "password_reset_failed", error.message);

  await writeAudit(
    context,
    admin,
    "user.password_reset_cancelled",
    "profile",
    studentId,
  );
  return json({ status: "cancelled" });
}
