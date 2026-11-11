import { requireProfile } from "../_shared/auth.ts";
import { RPCS, TABLES } from "../_shared/database.constants.ts";
import { emailChangeCodeEmail, sendEmail } from "../_shared/email.ts";
import {
  EMAIL_CODE_MAX_SENDS,
  EMAIL_CODE_RESEND_SECONDS,
  EMAIL_CODE_TTL_MINUTES,
  generateEmailCode,
  hashEmailCode,
} from "../_shared/email-code.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { maskEmail, parseEmail } from "../_shared/registration.ts";
import type { EdgeContext } from "../_shared/types.ts";
import type { RequestEmailChangeBody } from "./interfaces.ts";
import { loadStudentProfile } from "../_shared/student-profile.ts";

/**
 * POST /account/email-change
 * Envía (o reenvía) un código de 6 dígitos al correo nuevo. El correo de la
 * cuenta no cambia hasta confirmar el código en /account/email-change/confirm.
 */
export async function requestEmailChange(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const profile = await requireProfile(context, ["student"]);
  const userId = profile.id;
  const current = await loadStudentProfile(context, userId);
  const body = await readJson<RequestEmailChangeBody>(request);
  const email = parseEmail(body.email);
  if (email === current.email?.toLowerCase()) {
    throw new AppError(
      400,
      "email_unchanged",
      "The new email is the same as the current one.",
      { field: "email" },
    );
  }

  const { data: inUse, error: inUseError } = await context.supabaseAdmin.rpc(
    RPCS.emailInUse,
    { p_email: email, p_except_user_id: userId },
  );
  if (inUseError) {
    throw new AppError(500, "email_lookup_failed", inUseError.message);
  }
  if (inUse) {
    throw new AppError(
      409,
      "email_taken",
      "The email already has an account.",
      {
        field: "email",
      },
    );
  }

  const { data: previous, error: previousError } = await context.supabaseAdmin
    .from(TABLES.emailChangeRequests)
    .select("code_sent_at,send_count")
    .eq("user_id", userId)
    .maybeSingle();
  if (previousError) {
    throw new AppError(500, "email_change_failed", previousError.message);
  }
  if (previous && previous.send_count >= EMAIL_CODE_MAX_SENDS) {
    throw new AppError(
      429,
      "too_many_email_change_codes",
      "Too many codes were sent. Try again tomorrow.",
    );
  }
  if (previous) {
    const availableAt = new Date(previous.code_sent_at).getTime() +
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
  // Un pedido nuevo reemplaza al anterior: su código deja de servir.
  const { error } = await context.supabaseAdmin
    .from(TABLES.emailChangeRequests)
    .upsert({
      user_id: userId,
      new_email: email,
      code_hash: await hashEmailCode(userId, code),
      code_expires_at: codeExpiresAt,
      code_sent_at: sentAt.toISOString(),
      send_count: (previous?.send_count ?? 0) + 1,
      failed_attempts: 0,
    });
  if (error) throw new AppError(500, "email_change_failed", error.message);

  try {
    await sendEmail(
      emailChangeCodeEmail(
        email,
        current.given_names ?? profile.full_name,
        code,
        EMAIL_CODE_TTL_MINUTES,
      ),
    );
  } catch (sendError) {
    // Si el correo no salió, se puede volver a pedir enseguida.
    if (previous) {
      await context.supabaseAdmin
        .from(TABLES.emailChangeRequests)
        .update({
          code_sent_at: previous.code_sent_at,
          send_count: previous.send_count,
        })
        .eq("user_id", userId);
    } else {
      await context.supabaseAdmin
        .from(TABLES.emailChangeRequests)
        .delete()
        .eq("user_id", userId);
    }
    throw sendError;
  }

  return json({
    email: maskEmail(email),
    code_expires_at: codeExpiresAt,
    resend_available_at: new Date(
      sentAt.getTime() + EMAIL_CODE_RESEND_SECONDS * 1000,
    ).toISOString(),
  });
}
