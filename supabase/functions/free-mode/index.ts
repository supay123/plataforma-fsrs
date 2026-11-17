import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { getCatalog } from "./catalog.ts";
import { getQuestions } from "./questions.ts";
import { registerLead } from "./register-lead.ts";

// Modo gratuito del home, sin sesión. Las preguntas salen de la institución demo:
//   GET  /free-mode/catalog     grupos → cursos → temas para los selectores
//   GET  /free-mode/questions   10 preguntas al azar con su respuesta (?topic_id=)
//   POST /free-mode/leads       guarda al interesado y lo agrega al Google Sheet
export default {
  fetch: withAppSupabase(
    { auth: "publishable" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "free-mode", {
          "GET /catalog": getCatalog,
          "GET /questions": getQuestions,
          "POST /leads": registerLead,
        })
      ),
  ),
};
