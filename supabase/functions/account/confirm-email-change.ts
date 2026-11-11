import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import {
  EMAIL_CODE_MAX_ATTEMPTS,
  verifyEmailCode,
} from "../_shared/email-code.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { applyStudentEmail } from "../_shared/student-email.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { requiredString } from "../_shared/validation.ts";
import type { ConfirmEmailChangeBody } from "./interfaces.ts";

/**
 * POST /account/email-change/confirm
 * Verifica el código enviado al correo nuevo y lo deja como correo de la
 * cuenta (también para iniciar sesión). El código se borra al usarse.
 */
export async function confirmEmailChange(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const profile = await requireProfile(context, ["student"]);
  const userId = profile.id;
  const body = await readJson<ConfirmEmailChangeBody>(request);
  const code = requiredString(body.code, "code", 6);
  if (!/^\d{6}$/.test(code)) {
    throw new AppError(400, "invalid_email_code", "The code is incorrect.");
  }

  const { data: pending, error: pendingError } = await context.supabaseAdmin
    .from(TABLES.emailChangeRequests)
    .select("new_email,code_hash,code_expires_at,failed_attempts")
    .eq("user_id", userId)
    .maybeSingle();
  if (pendingError) {
    throw new AppError(500, "email_change_failed", pendingError.message);
  }
  if (!pending) {
    throw new AppError(
      404,
      "email_change_not_found",
      "There is no email change in progress. Request a new code.",
    );
  }
  if (pending.failed_attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    throw new AppError(
      429,
      "email_code_locked",
      "Too many incorrect attempts. Request a new code.",
    );
  }
  if (new Date(pending.code_expires_at) <= new Date()) {
    throw new AppError(
      410,
      "email_code_expired",
      "The code expired. Request a new one.",
    );
  }
  if (!await verifyEmailCode(userId, code, pending.code_hash)) {
    const attempts = pending.failed_attempts + 1;
    await context.supabaseAdmin
      .from(TABLES.emailChangeRequests)
      .update({ failed_attempts: attempts })
      .eq("user_id", userId);
    throw new AppError(400, "invalid_email_code", "The code is incorrect.", {
      attempts_left: Math.max(0, EMAIL_CODE_MAX_ATTEMPTS - attempts),
    });
  }

  // Se consume borrando la fila; si dos pedidos llegan a la vez, solo uno la
  // encuentra.
  const { data: consumed, error: consumeError } = await context.supabaseAdmin
    .from(TABLES.emailChangeRequests)
    .delete()
    .eq("user_id", userId)
    .eq("code_hash", pending.code_hash)
    .select("new_email")
    .maybeSingle();
  if (consumeError) {
    throw new AppError(500, "email_change_failed", consumeError.message);
  }
  if (!consumed) {
    throw new AppError(
      404,
      "email_change_not_found",
      "There is no email change in progress. Request a new code.",
    );
  }
  const newEmail = consumed.new_email;

  await applyStudentEmail(context, userId, newEmail);

  await writeAudit(
    context,
    profile,
    "user.email_changed",
    "profile",
    userId,
  );
  return json({ email: newEmail });
}
