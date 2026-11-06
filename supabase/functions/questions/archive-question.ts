import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import { authorizedTopic } from "./access.ts";

/**
 * DELETE /questions?id=...
 * Archiva una pregunta para que deje de aparecer en el tema y en las sesiones
 * nuevas, conservando el historial de los estudiantes que ya la respondieron.
 */
export async function archiveQuestionHandler(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const questionId = uuid(
    new URL(request.url).searchParams.get("id"),
    "id",
  );

  const { data: question, error: questionError } = await context.supabaseAdmin
    .from(TABLES.questions)
    .select("id,topic_id,status")
    .eq("id", questionId)
    .maybeSingle();
  if (questionError) {
    throw new AppError(500, "question_lookup_failed", questionError.message);
  }
  if (!question || question.status === "archived") {
    throw new AppError(404, "question_not_found", "Question not found.");
  }

  await authorizedTopic(context, question.topic_id);

  const { error } = await context.supabaseAdmin
    .from(TABLES.questions)
    .update({ status: "archived" })
    .eq("id", questionId);
  if (error) {
    throw new AppError(400, "question_archive_failed", error.message);
  }
  return json({ question_id: questionId });
}
