import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { getLastGrades } from "./last-grades.ts";
import { getStreak } from "./streak.ts";

// Mis logros del estudiante. La medalla y el nivel ya tienen su endpoint
// (`GET /medals/me`, `GET /practice-session/xp-rules`); aquí solo van los datos
// que no existían.
//   GET /achievements/streak       racha de días activos
//   GET /achievements/last-grades  nota de la última sesión (y, más adelante, de la última lección de Modo Ruta)
export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "achievements", {
          "GET /streak": getStreak,
          "GET /last-grades": getLastGrades,
        })
      ),
  ),
};
