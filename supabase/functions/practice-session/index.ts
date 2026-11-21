import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { startPractice } from "./start.ts";
import { submitPractice } from "./submit.ts";
import { xpRules } from "./xp-rules.ts";

// Práctica del estudiante. Cada endpoint tiene una sola tarea:
//   POST /practice-session/start   reanuda o crea la sesión del tema y devuelve
//                                  sus preguntas con la clave de respuestas cifrada
//   GET  /practice-session/xp-rules montos de xp del colegio y nivel actual
//   POST /practice-session/submit  guarda todas las respuestas, aplica FSRS,
//                                  cierra la sesión y otorga el xp ganado
export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "practice-session", {
          "POST /start": startPractice,
          "GET /xp-rules": xpRules,
          "POST /submit": submitPractice,
        })
      ),
  ),
};
