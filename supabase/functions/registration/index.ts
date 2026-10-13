import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { createPayment } from "./create-payment.ts";
import { paymentStatus } from "./payment-status.ts";
import { simulateRegistrationPayment } from "./simulate-payment.ts";
import { requestCode } from "./request-code.ts";
import { validateCode } from "./validate-code.ts";
import { validateStudent } from "./validate-student.ts";

// Registro de estudiantes por su cuenta. Cada endpoint tiene una sola tarea:
//   POST /registration/student/validate  valida los datos y crea el registro pendiente
//   POST /registration/request-code      envía o reenvía el código al correo
//   POST /registration/validateCode      verifica el código del correo
//   POST /registration/payment           crea el cobro con QR del plan elegido
//   GET  /registration/payment           estado del pago; activa la cuenta al pagarse
//   POST /registration/payment/simulate  solo modo prueba: da el cobro por pagado
export default {
  fetch: withAppSupabase(
    { auth: "publishable" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "registration", {
          "POST /student/validate": validateStudent,
          "POST /request-code": requestCode,
          "POST /validateCode": validateCode,
          "POST /payment": createPayment,
          "GET /payment": paymentStatus,
          "POST /payment/simulate": simulateRegistrationPayment,
        })
      ),
  ),
};
