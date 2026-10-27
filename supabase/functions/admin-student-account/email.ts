import { writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { parseEmail } from "../_shared/registration.ts";
import { applyStudentEmail } from "../_shared/student-email.ts";
import type { EdgeContext } from "../_shared/types.ts";
import type { UpdateStudentEmailBody } from "./interfaces.ts";
import { requireStudent } from "./student.ts";

/**
 * PUT /admin-student-account/email
 * Cambia el correo del estudiante sin verificación, también para iniciar
 * sesión. Se anulan el cambio de correo y el link de restablecimiento que
 * tuviera pendientes, porque iban al correo anterior.
 */
export async function updateStudentEmail(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<UpdateStudentEmailBody>(request);
  const { admin, studentId } = await requireStudent(context, body.user_id);
  const email = parseEmail(body.email);

  await applyStudentEmail(context, studentId, email);
  const [emailChange, passwordReset] = await Promise.all([
    context.supabaseAdmin.from(TABLES.emailChangeRequests).delete().eq(
      "user_id",
      studentId,
    ),
    context.supabaseAdmin.from(TABLES.passwordResetCodes).delete().eq(
      "user_id",
      studentId,
    ),
  ]);
  const cleanupError = emailChange.error ?? passwordReset.error;
  if (cleanupError) {
    throw new AppError(500, "email_change_failed", cleanupError.message);
  }

  await writeAudit(context, admin, "user.email_changed", "profile", studentId);
  return json({ email });
}
