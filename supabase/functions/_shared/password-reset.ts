import { linkWithCode } from "./link-code.ts";

// Links para restablecer la contraseña (el código lo genera link-code.ts).

export const PASSWORD_RESET_TTL_MINUTES = 60;
export const PASSWORD_RESET_RESEND_SECONDS = 60;
export const PASSWORD_RESET_PATH = "/estudiante/reset";

export function passwordResetLink(
  origin: string,
  code: string,
  instId?: string | null,
): string {
  return linkWithCode(origin, PASSWORD_RESET_PATH, code, instId);
}
