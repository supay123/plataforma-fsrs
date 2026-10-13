import { writeAudit } from "../_shared/auth.ts";
import { RPCS } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { sendPasswordResetLink } from "../_shared/password-reset-link.ts";
import { parseEmail } from "../_shared/registration.ts";
import type { AppProfile, EdgeContext } from "../_shared/types.ts";
import type { RequestLinkBody } from "./interfaces.ts";

/**
 * POST /password-reset/request-link
 * "¿Olvidaste tu contraseña?" del login del estudiante: envía el link al
 * correo si pertenece a un estudiante activo. Responde siempre lo mismo, para
 * no revelar qué correos tienen cuenta.
 */
export async function requestLink(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<RequestLinkBody>(request);
  const email = parseEmail(body.email);

  const { data, error } = await context.supabaseAdmin.rpc(
    RPCS.findProfileByEmail,
    { p_email: email },
  );
  if (error) throw new AppError(500, "password_reset_failed", error.message);
  const profile = data?.[0] as AppProfile | undefined;

  if (profile?.role === "student" && profile.is_active) {
    try {
      await sendPasswordResetLink(request, context, {
        userId: profile.id,
        email,
        name: profile.full_name,
      });
      await writeAudit(
        context,
        profile,
        "user.password_reset_requested",
        "profile",
        profile.id,
      );
    } catch (sendError) {
      // Si pidió otro hace menos de un minuto, el anterior sigue sirviendo.
      // Cualquier otro fallo se registra sin revelarlo en la respuesta.
      const tooSoon = sendError instanceof AppError &&
        sendError.code === "password_reset_resend_too_soon";
      if (!tooSoon) console.error("Password reset link failed", sendError);
    }
  }

  return json({ status: "requested" });
}
