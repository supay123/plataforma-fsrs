import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile } from "../_shared/auth.ts";
import { RPCS } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { sessionPayload } from "../_shared/session.ts";
import { uuid } from "../_shared/validation.ts";
import type { StartSessionBody } from "./interfaces.ts";

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const student = await requireProfile(context, ["student"], true);
        const body = await readJson<StartSessionBody>(request);
        const topicId = uuid(body.topic_id, "topic_id");
        const { data: sessionId, error } = await context.supabaseAdmin
          .rpc(RPCS.startSession, {
            p_student_id: student.id,
            p_topic_id: topicId,
            p_limit: 20,
          });
        if (error || typeof sessionId !== "string") {
          throw new AppError(
            400,
            "session_start_failed",
            error?.message ?? "Unable to start session.",
          );
        }
        return json(await sessionPayload(context, student, sessionId), 201);
      }),
  ),
};
