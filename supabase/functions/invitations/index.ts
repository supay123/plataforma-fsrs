import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { cancelInvitationHandler } from "./cancel-invitation.ts";
import { createInvitationHandler } from "./create-invitation.ts";
import { listInvitationsHandler } from "./list-invitations.ts";
import { resendInvitationHandler } from "./resend-invitation.ts";

// Invitaciones de estudiantes (solo administradores). Cada endpoint tiene una
// sola tarea:
//   GET    /invitations          invitaciones sin aceptar
//   POST   /invitations          invita a un estudiante por correo
//   POST   /invitations/resend   reenvía una invitación con un link nuevo
//   DELETE /invitations?id=...   anula una invitación
export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "invitations", {
          "GET /": listInvitationsHandler,
          "POST /": createInvitationHandler,
          "POST /resend": resendInvitationHandler,
          "DELETE /": cancelInvitationHandler,
        })
      ),
  ),
};
