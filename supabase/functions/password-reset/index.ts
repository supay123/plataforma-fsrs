import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { checkCode } from "./check-code.ts";
import { requestLink } from "./request-link.ts";
import { resetPassword } from "./reset-password.ts";

// Restablecer la contraseña con un link enviado al correo (sin sesión: el
// código del link identifica al usuario). Cada endpoint tiene una sola tarea:
//   POST /password-reset/request-link  envía el link ("¿Olvidaste tu contraseña?")
//   GET  /password-reset?code=...      indica si el link sigue vigente
//   POST /password-reset               usa el link y guarda la nueva contraseña
export default {
  fetch: withAppSupabase(
    { auth: "publishable" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "password-reset", {
          "POST /request-link": requestLink,
          "GET /": checkCode,
          "POST /": resetPassword,
        })
      ),
  ),
};
