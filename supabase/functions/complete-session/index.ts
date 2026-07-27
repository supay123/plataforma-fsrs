import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile } from "../_shared/auth.ts";
import { RPCS, VIEWS } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { uuid } from "../_shared/validation.ts";
import type { CompleteSessionBody } from "./interfaces.ts";

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const student = await requireProfile(context, ["student"], true);
        const body = await readJson<CompleteSessionBody>(request);
        const sessionId = uuid(body.session_id, "session_id");
        const { data: completedId, error } = await context.supabaseAdmin
          .rpc(RPCS.completeSession, {
            p_student_id: student.id,
            p_session_id: sessionId,
          });
        if (error || typeof completedId !== "string") {
          throw new AppError(
            400,
            "session_completion_failed",
            error?.message ?? "Unable to complete session.",
          );
        }

        const { data: result, error: resultError } = await context.supabaseAdmin
          .from(VIEWS.sessionResults)
          .select("*")
          .eq("session_id", completedId)
          .single();
        if (resultError) {
          throw new AppError(500, "session_result_failed", resultError.message);
        }
        return json({ session: result });
      }),
  ),
};
