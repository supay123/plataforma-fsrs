import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { getRankingCache } from "./get-cache.ts";
import { getRankingSettings } from "./get-settings.ts";
import { refreshRankingCache } from "./refresh-cache.ts";
import { saveRankingSettings } from "./save-settings.ts";

// Ranking por institución y grupo (profesor). La configuración de cada
// institución se crea sola (trigger) y viene desactivada.
//   GET /ranking/settings  configuración de la institución (admin, profesor, estudiante)
//   PUT /ranking/settings  modifica (o crea) la configuración (admin)
//   PUT /ranking/cache     crea o reemplaza la caché del usuario para un tipo (estudiante, profesor)
//   GET /ranking/cache     página de la caché: ?type=&page=&page_size= (estudiante, profesor);
//                          404 ranking_cache_not_found si no existe o venció
export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "ranking", {
          "GET /settings": getRankingSettings,
          "PUT /settings": saveRankingSettings,
          "PUT /cache": refreshRankingCache,
          "GET /cache": getRankingCache,
        })
      ),
  ),
};
