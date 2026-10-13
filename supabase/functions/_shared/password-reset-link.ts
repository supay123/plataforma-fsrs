import { appOrigin } from "./app-url.ts";
import { TABLES } from "./database.constants.ts";
import { passwordResetEmail, sendEmail } from "./email.ts";
import { AppError } from "./errors.ts";
import { generateLinkCode, hashLinkCode } from "./link-code.ts";
import {
  PASSWORD_RESET_RESEND_SECONDS,
  PASSWORD_RESET_TTL_MINUTES,
  passwordResetLink,
} from "./password-reset.ts";
import type { EdgeContext } from "./types.ts";

export interface PasswordResetRecipient {
  userId: string;
  email: string;
  /** Nombre para el saludo del correo. */
  name: string;
}

export interface SentPasswordResetLink {
  expires_at: string;
  resend_available_at: string;
}

/**
 * Crea el link para restablecer la contraseña y lo envía por correo. El link
 * vence en PASSWORD_RESET_TTL_MINUTES y pedir otro invalida el anterior.
 * Lanza 429 password_reset_resend_too_soon si se pidió otro hace menos de
 * PASSWORD_RESET_RESEND_SECONDS.
 */
export async function sendPasswordResetLink(
  request: Request,
  context: EdgeContext,
  recipient: PasswordResetRecipient,
): Promise<SentPasswordResetLink> {
  const { data: previous, error: previousError } = await context.supabaseAdmin
    .from(TABLES.passwordResetCodes)
    .select("created_at")
    .eq("user_id", recipient.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousError) {
    throw new AppError(500, "password_reset_failed", previousError.message);
  }
  if (previous) {
    const availableAt = new Date(previous.created_at).getTime() +
      PASSWORD_RESET_RESEND_SECONDS * 1000;
    if (availableAt > Date.now()) {
      throw new AppError(
        429,
        "password_reset_resend_too_soon",
        "Wait before requesting another link.",
        { resend_available_at: new Date(availableAt).toISOString() },
      );
    }
  }

  const code = generateLinkCode();
  const codeHash = await hashLinkCode(code);
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + PASSWORD_RESET_TTL_MINUTES * 60_000,
  ).toISOString();
  const { error: deleteError } = await context.supabaseAdmin
    .from(TABLES.passwordResetCodes)
    .delete()
    .eq("user_id", recipient.userId);
  if (deleteError) {
    throw new AppError(500, "password_reset_failed", deleteError.message);
  }
  const { error: insertError } = await context.supabaseAdmin
    .from(TABLES.passwordResetCodes)
    .insert({
      code_hash: codeHash,
      user_id: recipient.userId,
      expires_at: expiresAt,
      created_at: createdAt.toISOString(),
    });
  if (insertError) {
    throw new AppError(500, "password_reset_failed", insertError.message);
  }

  try {
    await sendEmail(
      passwordResetEmail(
        recipient.email,
        recipient.name,
        passwordResetLink(appOrigin(request), code),
        PASSWORD_RESET_TTL_MINUTES,
      ),
    );
  } catch (sendError) {
    // Sin correo, el link no sirve: se borra para poder pedir otro enseguida.
    await context.supabaseAdmin
      .from(TABLES.passwordResetCodes)
      .delete()
      .eq("code_hash", codeHash);
    throw sendError;
  }

  return {
    expires_at: expiresAt,
    resend_available_at: new Date(
      createdAt.getTime() + PASSWORD_RESET_RESEND_SECONDS * 1000,
    ).toISOString(),
  };
}
