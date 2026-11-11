import { RPCS, TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { hashLinkCode, isLinkCodeFormat } from "../_shared/link-code.ts";
import { parseNewPassword } from "../_shared/registration.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { invalidResetCode } from "./check-code.ts";
import type { ResetPasswordBody } from "./interfaces.ts";

/**
 * POST /password-reset
 * Usa el link (se borra, no sirve otra vez), guarda la nueva contraseña y
 * cierra todas las sesiones abiertas de ese usuario.
 */
export async function resetPassword(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<ResetPasswordBody>(request);
  // Primero la contraseña: si no cumple las reglas, el link sigue sirviendo.
  const password = parseNewPassword(body.password);
  if (!isLinkCodeFormat(body.code)) throw invalidResetCode();
  const codeHash = await hashLinkCode(body.code);

  // Borrar y devolver en un solo paso: si llegan dos pedidos a la vez, solo
  // uno encuentra la fila.
  const { data: consumed, error: consumeError } = await context.supabaseAdmin
    .from(TABLES.passwordResetCodes)
    .delete()
    .eq("code_hash", codeHash)
    .gt("expires_at", new Date().toISOString())
    .select("user_id,expires_at,created_at")
    .maybeSingle();
  if (consumeError) {
    throw new AppError(500, "password_reset_failed", consumeError.message);
  }
  if (!consumed) throw invalidResetCode();

  const { error: updateError } = await context.supabaseAdmin.auth.admin
    .updateUserById(consumed.user_id, { password });
  if (updateError) {
    // La contraseña no cambió: el link vuelve a quedar disponible.
    await context.supabaseAdmin.from(TABLES.passwordResetCodes).insert({
      code_hash: codeHash,
      ...consumed,
    });
    throw new AppError(500, "password_reset_failed", updateError.message);
  }

  const { error: revokeError } = await context.supabaseAdmin.rpc(
    RPCS.revokeUserSessions,
    { p_user_id: consumed.user_id },
  );
  if (revokeError) {
    // La contraseña ya cambió; las sesiones vencerán solas.
    console.error("Session revocation failed", revokeError);
  }

  const { error: auditError } = await context.supabaseAdmin
    .from(TABLES.auditLogs)
    .insert({
      actor_user_id: consumed.user_id,
      action: "user.password_reset",
      entity_type: "profile",
      entity_id: consumed.user_id,
      metadata: {},
    });
  if (auditError) console.error("Audit log insert failed", auditError);

  return json({ status: "password_updated" });
}
