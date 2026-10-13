import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { receiveWebhook } from "./webhook.ts";

// Avisos de Kuti. Kuti no envía llaves de Supabase: cada aviso se autentica
// con su firma (X-Kuti-Signature).
//   POST /kuti/webhook  aplica el resultado de un cobro
export default {
  fetch: withAppSupabase(
    { auth: "none" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "kuti", {
          "POST /webhook": receiveWebhook,
        })
      ),
  ),
};
