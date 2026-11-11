import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { cancelPasswordReset } from "./cancel-password-reset.ts";
import { confirmEmailChange } from "./confirm-email-change.ts";
import { createPayment } from "./create-payment.ts";
import { getProfile } from "./get-profile.ts";
import { paymentStatus } from "./payment-status.ts";
import { requestEmailChange } from "./request-email-change.ts";
import { requestPasswordReset } from "./request-password-reset.ts";
import { updateProfile } from "./update-profile.ts";

// Perfil del estudiante con sesión iniciada. Cada endpoint tiene una sola tarea:
//   GET    /account/profile               datos del perfil
//   PUT    /account/profile               actualiza los datos editables
//   POST   /account/email-change          envía un código al correo nuevo
//   POST   /account/email-change/confirm  verifica el código y cambia el correo
//   POST   /account/password-reset        envía el link para restablecer la contraseña
//   DELETE /account/password-reset        anula el link enviado
//   POST   /account/payment               cobra con Yape la renovación del plan
//   GET    /account/payment               estado del pago; extiende el plan al pagarse
export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "account", {
          "GET /profile": getProfile,
          "PUT /profile": updateProfile,
          "POST /email-change": requestEmailChange,
          "POST /email-change/confirm": confirmEmailChange,
          "POST /password-reset": requestPasswordReset,
          "DELETE /password-reset": cancelPasswordReset,
          "POST /payment": createPayment,
          "GET /payment": paymentStatus,
        })
      ),
  ),
};
