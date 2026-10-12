import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { AppError, json } from "../_shared/errors.ts";
import { sendPasswordResetLink } from "../_shared/password-reset-link.ts";
import { maskEmail } from "../_shared/registration.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { loadStudentProfile } from "./profile.ts";

/**
 * POST /account/password-reset
 * Envía al correo de la cuenta un link para crear una nueva contraseña. El
 * link vence en 1 hora y pedir otro invalida el anterior.
 */
export async function requestPasswordReset(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const profile = await requireProfile(context, ["student"]);
  const { email, given_names } = await loadStudentProfile(context, profile.id);
  if (!email) {
    throw new AppError(
      409,
      "email_required",
      "Add an email to your profile before resetting the password.",
    );
  }

  const sent = await sendPasswordResetLink(request, context, {
    userId: profile.id,
    email,
    name: given_names ?? profile.full_name,
  });
  await writeAudit(
    context,
    profile,
    "user.password_reset_requested",
    "profile",
    profile.id,
  );
  return json({ email: maskEmail(email), ...sent });
}
