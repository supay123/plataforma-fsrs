import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { acceptInvitation } from "./accept-invitation.ts";
import { checkInvitation } from "./check-invitation.ts";

// Invitación de un estudiante (sin sesión: el código del link la identifica).
// Cada endpoint tiene una sola tarea:
//   GET  /student-invitation?code=...  datos fijos de la invitación
//   POST /student-invitation           completa los datos y crea la cuenta
export default {
  fetch: withAppSupabase(
    { auth: "publishable" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "student-invitation", {
          "GET /": checkInvitation,
          "POST /": acceptInvitation,
        })
      ),
  ),
};
