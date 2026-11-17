import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { calculateMedal } from "./calculate.ts";
import { getMedalSettings } from "./get-settings.ts";
import { getMyMedal } from "./my-medal.ts";
import { saveMedalSettings } from "./save-settings.ts";
import { getTopicStars } from "./topic-stars.ts";

// Medallas. La configuración de cada institución y la medalla de cada estudiante
// se crean solas (triggers de la base de datos), por eso no hay endpoints de alta.
//   GET  /medals/settings     configuración de la institución (admin, profesor, estudiante)
//   PUT  /medals/settings     modifica (o crea) la configuración (admin)
//   GET  /medals/me           medalla y estrellas actuales (estudiante)
//   GET  /medals/topic-stars  mejor marca de estrellas por tema (estudiante)
//   POST /medals/calculate    aplica las estrellas de una sesión terminada (estudiante)
export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "medals", {
          "GET /settings": getMedalSettings,
          "PUT /settings": saveMedalSettings,
          "GET /me": getMyMedal,
          "GET /topic-stars": getTopicStars,
          "POST /calculate": calculateMedal,
        })
      ),
  ),
};
