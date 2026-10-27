import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { receiveWebhook } from "./webhook.ts";

// Avisos de Mercado Pago. Mercado Pago no envía llaves de Supabase: cada aviso
// se autentica con su firma (x-signature).
//   POST /mercadopago/webhook  aplica el resultado de una orden (evento Order)
export default {
  fetch: withAppSupabase(
    { auth: "none" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "mercadopago", {
          "POST /webhook": receiveWebhook,
        })
      ),
  ),
};
