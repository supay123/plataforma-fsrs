import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { registrationCodeEmail, sendEmail } from "../_shared/email.ts";
import {
  EMAIL_CODE_MAX_SENDS,
  EMAIL_CODE_RESEND_SECONDS,
  EMAIL_CODE_TTL_MINUTES,
  generateEmailCode,
  hashEmailCode,
} from "../_shared/email-code.ts";
import { maskEmail } from "../_shared/registration.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import type { RequestCodeBody } from "./interfaces.ts";
import { findPending } from "./pending.ts";

/**
 * POST /registration/request-code
 * Envía (o reenvía) el código de 6 dígitos al correo del registro pendiente.
 * Máximo EMAIL_CODE_MAX_SENDS códigos, separados por EMAIL_CODE_RESEND_SECONDS.
 */
export async function requestCode(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<RequestCodeBody>(request);
  const registration = await findPending(
    context,
    uuid(body.registration_id, "registration_id"),
  );
  if (registration.email_verified_at) {
    throw new AppError(
      409,
      "email_already_verified",
      "The email is already verified.",
    );
  }
  if (registration.email_code_send_count >= EMAIL_CODE_MAX_SENDS) {
    throw new AppError(
      429,
      "too_many_email_codes",
      "Too many codes were sent. Start again.",
    );
  }
  if (registration.email_code_sent_at) {
    const availableAt = new Date(registration.email_code_sent_at).getTime() +
      EMAIL_CODE_RESEND_SECONDS * 1000;
    if (availableAt > Date.now()) {
      throw new AppError(
        429,
        "email_code_resend_too_soon",
        "Wait before requesting another code.",
        { resend_available_at: new Date(availableAt).toISOString() },
      );
    }
  }

  const code = generateEmailCode();
  const sentAt = new Date();
  const codeExpiresAt = new Date(
    sentAt.getTime() + EMAIL_CODE_TTL_MINUTES * 60_000,
  ).toISOString();
  const { error } = await context.supabaseAdmin
    .from(TABLES.studentRegistrations)
    .update({
      email_code_hash: await hashEmailCode(registration.id, code),
      email_code_expires_at: codeExpiresAt,
      email_code_sent_at: sentAt.toISOString(),
      email_code_send_count: registration.email_code_send_count + 1,
      email_code_failed_attempts: 0,
    })
    .eq("id", registration.id);
  if (error) {
    throw new AppError(500, "email_code_failed", error.message);
  }
  try {
    await sendEmail(
      registrationCodeEmail(
        registration.email,
        registration.given_names,
        code,
        EMAIL_CODE_TTL_MINUTES,
      ),
    );
  } catch (sendError) {
    // Si el correo no salió, se puede volver a pedir enseguida.
    await context.supabaseAdmin
      .from(TABLES.studentRegistrations)
      .update({
        email_code_sent_at: registration.email_code_sent_at,
        email_code_send_count: registration.email_code_send_count,
      })
      .eq("id", registration.id);
    throw sendError;
  }

  return json({
    email: maskEmail(registration.email),
    code_expires_at: codeExpiresAt,
    resend_available_at: new Date(
      sentAt.getTime() + EMAIL_CODE_RESEND_SECONDS * 1000,
    ).toISOString(),
  });
}
