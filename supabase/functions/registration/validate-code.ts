import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import {
  EMAIL_CODE_MAX_ATTEMPTS,
  verifyEmailCode,
} from "../_shared/email-code.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { requiredString, uuid } from "../_shared/validation.ts";
import type { ValidateCodeBody } from "./interfaces.ts";
import { findPending } from "./pending.ts";

/**
 * POST /registration/validateCode
 * Verifica el código enviado al correo. Cada código permite
 * EMAIL_CODE_MAX_ATTEMPTS intentos fallidos antes de pedir uno nuevo.
 */
export async function validateCode(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<ValidateCodeBody>(request);
  const registration = await findPending(
    context,
    uuid(body.registration_id, "registration_id"),
  );
  if (registration.email_verified_at) {
    return json({ status: "verified", registration_id: registration.id });
  }
  const code = requiredString(body.code, "code", 6);
  if (!/^\d{6}$/.test(code)) {
    throw new AppError(400, "invalid_email_code", "The code is incorrect.");
  }
  if (
    !registration.email_code_hash ||
    registration.email_code_failed_attempts >= EMAIL_CODE_MAX_ATTEMPTS
  ) {
    throw new AppError(
      429,
      "email_code_locked",
      "Too many incorrect attempts. Request a new code.",
    );
  }
  if (
    !registration.email_code_expires_at ||
    new Date(registration.email_code_expires_at) <= new Date()
  ) {
    throw new AppError(
      410,
      "email_code_expired",
      "The code expired. Request a new one.",
    );
  }
  if (
    !await verifyEmailCode(registration.id, code, registration.email_code_hash)
  ) {
    const attempts = registration.email_code_failed_attempts + 1;
    await context.supabaseAdmin
      .from(TABLES.studentRegistrations)
      .update({ email_code_failed_attempts: attempts })
      .eq("id", registration.id);
    throw new AppError(400, "invalid_email_code", "The code is incorrect.", {
      attempts_left: Math.max(0, EMAIL_CODE_MAX_ATTEMPTS - attempts),
    });
  }

  const { error } = await context.supabaseAdmin
    .from(TABLES.studentRegistrations)
    .update({
      email_verified_at: new Date().toISOString(),
      email_code_hash: null,
    })
    .eq("id", registration.id);
  if (error) {
    throw new AppError(500, "email_verification_failed", error.message);
  }
  return json({ status: "verified", registration_id: registration.id });
}
