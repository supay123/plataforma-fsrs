import { requireProfile } from "../_shared/auth.ts";
import { RPCS } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { sessionPayload } from "../_shared/session.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import type { StartPracticeBody } from "./interfaces.ts";

/** Reanuda la sesión en curso del tema o crea una con hasta 20 preguntas. */
export async function startPractice(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"], true);
  const body = await readJson<StartPracticeBody>(request);
  const topicId = uuid(body.topic_id, "topic_id");
  const { data: sessionId, error } = await context.supabaseAdmin
    .rpc(RPCS.startSession, {
      p_student_id: student.id,
      p_topic_id: topicId,
      p_limit: 20,
    });
  if (error || typeof sessionId !== "string") {
    const insufficient = error?.message.match(
      /insufficient_active_questions:required=(\d+),available=(\d+)/,
    );
    if (insufficient) {
      const required = Number(insufficient[1]);
      const available = Number(insufficient[2]);
      throw new AppError(
        409,
        "insufficient_active_questions",
        `Este tema necesita ${required} preguntas activas y actualmente tiene ${available}.`,
        { required, available },
      );
    }
    throw new AppError(
      400,
      "session_start_failed",
      error?.message ?? "Unable to start session.",
    );
  }
  return json(await sessionPayload(context, student, sessionId), 201);
}
