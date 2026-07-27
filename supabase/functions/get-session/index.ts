import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile } from "../_shared/auth.ts";
import { handle, json, readJson } from "../_shared/errors.ts";
import { sessionPayload } from "../_shared/session.ts";
import { uuid } from "../_shared/validation.ts";
import type { GetSessionBody } from "./interfaces.ts";

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const student = await requireProfile(context, ["student"], true);
        const body = await readJson<GetSessionBody>(request);
        const sessionId = uuid(body.session_id, "session_id");
        return json(await sessionPayload(context, student, sessionId));
      }),
  ),
};
