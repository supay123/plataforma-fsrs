import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import { hashLinkCode, isLinkCodeFormat } from "../_shared/link-code.ts";
import type { EdgeContext } from "../_shared/types.ts";

export function invalidResetCode(): AppError {
  return new AppError(
    404,
    "invalid_reset_code",
    "The link is not valid or has expired.",
  );
}

/**
 * GET /password-reset?code=...
 * Indica si el link sigue vigente, sin usarlo. Así la página decide si muestra
 * el formulario o el mensaje de acceso denegado.
 */
export async function checkCode(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const code = new URL(request.url).searchParams.get("code");
  if (!isLinkCodeFormat(code)) throw invalidResetCode();

  const { data, error } = await context.supabaseAdmin
    .from(TABLES.passwordResetCodes)
    .select("expires_at")
    .eq("code_hash", await hashLinkCode(code))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new AppError(500, "password_reset_failed", error.message);
  if (!data) throw invalidResetCode();
  return json({ status: "valid", expires_at: data.expires_at });
}
