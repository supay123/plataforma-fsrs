import { requireProfile } from "../_shared/auth.ts";
import { json } from "../_shared/errors.ts";
import { listInvitations } from "../_shared/invitations.ts";
import type { EdgeContext } from "../_shared/types.ts";

/**
 * GET /invitations
 * Invitaciones sin aceptar (vigentes y vencidas), de la más reciente a la más
 * antigua.
 */
export async function listInvitationsHandler(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  await requireProfile(context, ["admin"]);
  return json({ invitations: await listInvitations(context) });
}
