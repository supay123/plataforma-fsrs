import { requireProfile } from "../_shared/auth.ts";
import { RPCS, TABLES } from "../_shared/database.constants.ts";
import type { Json } from "../_shared/database.types.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import {
  gradeRouteAttempt,
  parseRouteAnswers,
  ROUTE_PASS_PERCENT,
} from "../_shared/route-mode.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import type { SubmitAttemptBody } from "./interfaces.ts";
import {
  loadStudentRoute,
  loadStudentRouteCourses,
  requireUnlockedLesson,
} from "./student-route.ts";

/**
 * POST /route-mode/attempts
 * Califica un intento con la clave de la base de datos, lo guarda, otorga el
 * xp de las preguntas bien respondidas por primera vez y devuelve el
 * resultado. Una lección bloqueada responde 403.
 */
export async function submitAttempt(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"], true);
  const body = await readJson<SubmitAttemptBody>(request);
  const lessonId = uuid(body.lesson_id, "lesson_id");
  const answers = parseRouteAnswers(body.answers);
  await requireUnlockedLesson(context, student, lessonId);

  const { data: lesson, error: lessonError } = await context.supabaseAdmin
    .from(TABLES.routeLessons)
    .select("questions_to_show")
    .eq("id", lessonId)
    .single();
  if (lessonError) {
    throw new AppError(500, "route_lesson_lookup_failed", lessonError.message);
  }
  const { data: questions, error } = await context.supabaseAdmin
    .from(TABLES.routeQuestions)
    .select("id,correct_option")
    .eq("lesson_id", lessonId);
  if (error) {
    throw new AppError(500, "route_question_lookup_failed", error.message);
  }

  const grading = gradeRouteAttempt(
    questions ?? [],
    answers,
    lesson.questions_to_show,
  );
  const { data: result, error: recordError } = await context.supabaseAdmin.rpc(
    RPCS.recordRouteAttempt,
    {
      p_student_id: student.id,
      p_lesson_id: lessonId,
      p_answers: answers as unknown as Json,
      p_correct_question_ids: grading.correct_question_ids,
      p_total_questions: grading.total_questions,
    },
  );
  if (recordError || !result) {
    throw new AppError(
      500,
      "route_attempt_failed",
      recordError?.message ?? "Unable to record the attempt.",
    );
  }

  // Contar el día como activo es secundario: si falla, el intento ya quedó guardado.
  const { error: activityError } = await context.supabaseAdmin.rpc(
    RPCS.recordStudentActivity,
    { p_student_id: student.id },
  );
  if (activityError) {
    console.error(JSON.stringify({
      event: "student_activity.failed",
      message: activityError.message,
    }));
  }

  const unlocked = await nextLessonId(context, student, lessonId);
  return json({
    ...(result as Record<string, Json>),
    pass_percent: ROUTE_PASS_PERCENT,
    next_lesson_id: grading.passed ? unlocked : null,
  });
}

/** Siguiente lección de la fila del mismo curso de ruta, si existe y ya está lista. */
async function nextLessonId(
  context: EdgeContext,
  student: Parameters<typeof loadStudentRoute>[1],
  lessonId: string,
): Promise<string | null> {
  const route = await loadStudentRoute(context, student);
  const row = route.flatMap((topic) =>
    topic.lessons.map((lesson) => ({
      ...lesson,
      route_course_id: topic.route_course_id,
    }))
  );
  const index = row.findIndex((lesson) => lesson.id === lessonId);
  const current = row[index];
  if (!current) return null;
  const next = row.slice(index + 1).find((lesson) =>
    lesson.route_course_id === current.route_course_id
  );
  return next?.id ?? null;
}

/**
 * GET /route-mode/progress — cursos de ruta, temas, lecciones y desbloqueos
 * del estudiante. Cada tema indica su curso en `route_course_id`.
 */
export async function getProgress(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"], true);
  return json({
    pass_percent: ROUTE_PASS_PERCENT,
    courses: await loadStudentRouteCourses(context, student),
    topics: await loadStudentRoute(context, student),
  });
}
