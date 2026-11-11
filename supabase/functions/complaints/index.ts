import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { submitSheet } from "./submit-sheet.ts";

// Libro de Reclamaciones virtual, sin sesión:
//   POST /complaints/sheets  numera la hoja, genera el PDF y la envía por correo
export default {
  fetch: withAppSupabase(
    { auth: "publishable" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "complaints", {
          "POST /sheets": submitSheet,
        })
      ),
  ),
};
