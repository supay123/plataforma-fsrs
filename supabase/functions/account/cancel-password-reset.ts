import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";

/**
 * DELETE /account/password-reset
 * Anula el link enviado (por ejemplo, si se pidió por error): se borra y deja
 * de servir. Después se puede pedir otro enseguida.
 */
export async function cancelPasswordReset(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  const profile = await requireProfile(context, ["student"]);
  const { error } = await context.supabaseAdmin
    .from(TABLES.passwordResetCodes)
    .delete()
    .eq("user_id", profile.id);
  if (error) throw new AppError(500, "password_reset_failed", error.message);

  await writeAudit(
    context,
    profile,
    "user.password_reset_cancelled",
    "profile",
    profile.id,
  );
  return json({ status: "cancelled" });
}
