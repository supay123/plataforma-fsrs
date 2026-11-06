import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import { authorizedTopic } from "./access.ts";

/**
 * DELETE /questions/topic?topic_id=...
 * Archiva todas las preguntas vigentes del tema de una sola vez.
 */
export async function archiveTopicQuestionsHandler(
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
    .update({ status: "archived" })
    .eq("topic_id", topicId)
    .neq("status", "archived")
    .select("id");
  if (error) {
    throw new AppError(400, "questions_archive_failed", error.message);
  }
  return json({ topic_id: topicId, archived: data?.length ?? 0 });
}
