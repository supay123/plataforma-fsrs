import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { RPCS } from "../_shared/database.constants.ts";
import { AppError, handle, json } from "../_shared/errors.ts";

// Entrega el siguiente número correlativo del Libro de Reclamaciones y la fecha
// y hora oficiales de presentación. La hoja se arma y envía desde el navegador.
export default {
  fetch: withAppSupabase(
    { auth: "publishable" },
    (_request, context) =>
      handle(async () => {
        const { data, error } = await context.supabaseAdmin.rpc(
          RPCS.nextComplaintSheetNumber,
        );
        if (error || data === null) {
          throw new AppError(
            500,
            "complaint_number_failed",
            "The complaint number could not be assigned.",
          );
        }
        return json({
          sheet_number: data,
          submitted_at: new Date().toISOString(),
        });
      }),
  ),
};
