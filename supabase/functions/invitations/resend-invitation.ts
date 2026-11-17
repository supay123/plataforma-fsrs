import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { json, readJson } from "../_shared/errors.ts";
import { resendInvitation } from "../_shared/invitations.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import type { ResendInvitationBody } from "./interfaces.ts";

/**
 * POST /invitations/resend
 * Envía otra vez la invitación con un link nuevo (el anterior deja de servir)
 * y renueva su vigencia.
 */
export async function resendInvitationHandler(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const admin = await requireProfile(context, ["admin"]);
  const body = await readJson<ResendInvitationBody>(request);
  const invitation = await resendInvitation(
    request,
    context,
    uuid(body.invitation_id, "invitation_id"),
  );
  await writeAudit(
    context,
    admin,
    "invitation.resent",
    "student_invitation",
    invitation.id,
  );
  return json({ invitation });
}
