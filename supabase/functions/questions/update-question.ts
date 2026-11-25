import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { option, requiredString, uuid } from "../_shared/validation.ts";
import { authorizedTopic } from "./access.ts";
import type { UpdateQuestionRequest } from "./interfaces.ts";

/**
 * PUT /questions?id=...
 * Corrige el texto, las alternativas, la respuesta correcta y la explicación
 * de una pregunta vigente. Conserva el id, así que el historial y el repaso
 * FSRS de los estudiantes siguen apuntando a la misma pregunta.
 */
export async function updateQuestionHandler(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const questionId = uuid(new URL(request.url).searchParams.get("id"), "id");
  const body = await readJson<Partial<UpdateQuestionRequest>>(request);

  const explanation = typeof body.explanation === "string" &&
      body.explanation.trim() !== ""
    ? requiredString(body.explanation, "explanation", 2000)
    : null;
  const changes = {
    statement: requiredString(body.statement, "statement", 2000),
    option_a: requiredString(body.option_a, "option_a", 1000),
    option_b: requiredString(body.option_b, "option_b", 1000),
    option_c: requiredString(body.option_c, "option_c", 1000),
    option_d: requiredString(body.option_d, "option_d", 1000),
    correct_option: option(body.correct_option),
    explanation,
  };

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
    .update(changes)
    .eq("id", questionId);
  if (error) {
    throw new AppError(400, "question_update_failed", error.message);
  }
  return json({ question_id: questionId });
}
