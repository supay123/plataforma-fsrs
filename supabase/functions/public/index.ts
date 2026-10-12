import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { listColleges } from "./colleges.ts";

// Datos públicos de solo lectura, sin sesión:
//   GET /public/colleges  colegios activos para el registro
export default {
  fetch: withAppSupabase(
    { auth: "publishable" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "public", {
          "GET /colleges": listColleges,
        })
      ),
  ),
};
