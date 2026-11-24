import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import { authorizedTopic } from "./access.ts";

/**
 * GET /questions?topic_id=...
 * Preguntas vigentes del tema, en orden de creación. Devuelve una lista vacía
 * cuando el tema todavía no tiene preguntas.
 */
export async function listQuestionsHandler(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const topicId = uuid(
    new URL(request.url).searchParams.get("topic_id"),
    "topic_id",
  );
  await authorizedTopic(context, topicId);

  const { data, error } = await context.supabaseAdmin
    .from(TABLES.questions)
    .select(
      "id,statement,option_a,option_b,option_c,option_d,correct_option,explanation,created_at",
    )
    .eq("topic_id", topicId)
    .neq("status", "archived")
    .order("created_at")
    .order("id");

  if (error) {
    throw new AppError(500, "question_lookup_failed", error.message);
  }
  return json({ questions: data ?? [] });
}
