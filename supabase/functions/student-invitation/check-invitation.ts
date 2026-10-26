import { json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { findValidInvitation } from "./find-invitation.ts";

/**
 * GET /student-invitation?code=...
 * Datos fijos de la invitación (correo, grupo, institución y periodo de acceso)
 * para mostrarlos en el formulario. 404 si el link no sirve.
 */
export async function checkInvitation(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const code = new URL(request.url).searchParams.get("code");
  const invitation = await findValidInvitation(context, code);
  return json({
    invitation: {
      email: invitation.email,
      teacher_id: invitation.teacher_id,
      teacher_name: invitation.teacher_name,
      college_id: invitation.college_id,
      college_name: invitation.college_name,
      access_valid_from: invitation.access_valid_from,
      access_valid_until: invitation.access_valid_until,
      expires_at: invitation.expires_at,
    },
  });
}
