import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import { FREE_MODE_QUESTION_COUNT, pickRandom } from "../_shared/free-mode.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import { demoCollegeId } from "./demo-college.ts";
import type { FreeModeQuestion } from "./interfaces.ts";

/**
 * GET /free-mode/questions?topic_id=<uuid>
 * 10 preguntas al azar del tema, cada una con su respuesta correcta y su
 * explicación: el navegador corrige al instante y no hay sesión que guardar.
 * Solo sirve temas de la institución demo.
 */
export async function getQuestions(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const topicId = uuid(
    new URL(request.url).searchParams.get("topic_id"),
    "topic_id",
  );
  const collegeId = await demoCollegeId(context);
  const { supabaseAdmin } = context;

  const { data: topic, error: topicError } = await supabaseAdmin
    .from(TABLES.topics)
    .select("id,name,course_id")
    .eq("id", topicId)
    .eq("status", "active")
    .maybeSingle();
  if (topicError) {
    throw new AppError(500, "free_mode_lookup_failed", topicError.message);
  }
  const { data: course } = topic
    ? await supabaseAdmin
      .from(TABLES.courses)
      .select("id")
      .eq("id", topic.course_id)
      .eq("college_id", collegeId)
      .eq("status", "active")
      .maybeSingle()
    : { data: null };
  if (!topic || !course) {
    throw new AppError(404, "topic_not_found", "Topic not found.");
  }

  const { data: questions, error } = await supabaseAdmin
    .from(TABLES.questions)
    .select(
      "id,statement,option_a,option_b,option_c,option_d,correct_option,explanation",
    )
    .eq("topic_id", topicId)
    .eq("status", "active");
  if (error) throw new AppError(500, "free_mode_lookup_failed", error.message);
  if ((questions ?? []).length < FREE_MODE_QUESTION_COUNT) {
    throw new AppError(
      409,
      "insufficient_active_questions",
      `This topic needs ${FREE_MODE_QUESTION_COUNT} active questions.`,
    );
  }

  return json({
    topic: { id: topic.id, name: topic.name },
    questions: pickRandom(
      questions!,
      FREE_MODE_QUESTION_COUNT,
    ) as FreeModeQuestion[],
  });
}
