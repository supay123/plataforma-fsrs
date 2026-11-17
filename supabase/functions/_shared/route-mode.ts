import { AppError } from "./errors.ts";
import type {
  RouteAnswerInput,
  RouteAttemptRecord,
  RouteGrading,
  RouteGradingKey,
  RouteLessonProgress,
  RouteLessonRecord,
  RouteQuestionInput,
  RouteTopicProgress,
  RouteTopicRecord,
} from "./interfaces/route-mode.interfaces.ts";
import { option, requiredString, uuid } from "./validation.ts";

export const ROUTE_PASS_PERCENT = 80;
export const ROUTE_QUESTIONS_PER_LESSON = 5;
export const ROUTE_LESSON_TEXT_MAX_LENGTH = 20000;

/** Porcentaje entero (hacia abajo) de aciertos: 4 de 5 es 80. */
export function routeScorePercent(correct: number, total: number): number {
  return total <= 0 ? 0 : Math.floor((correct * 100) / total);
}

/**
 * Califica un intento con la clave de la base de datos. Cada pregunta de la
 * lección debe responderse exactamente una vez.
 */
export function gradeRouteAttempt(
  key: RouteGradingKey[],
  answers: RouteAnswerInput[],
): RouteGrading {
  const answeredBy = new Map(
    answers.map((answer) => [answer.question_id, answer.selected_option]),
  );
  if (
    answeredBy.size !== answers.length ||
    answers.length !== key.length ||
    key.some((question) => !answeredBy.has(question.id))
  ) {
    throw new AppError(
      409,
      "incomplete_submission",
      "Every question of the lesson must be answered exactly once.",
    );
  }
  const correctIds = key
    .filter((question) =>
      answeredBy.get(question.id) === question.correct_option.trim()
    )
    .map((question) => question.id);
  const percent = routeScorePercent(correctIds.length, key.length);
  return {
    total_questions: key.length,
    correct_count: correctIds.length,
    score_percent: percent,
    passed: percent >= ROUTE_PASS_PERCENT,
    correct_question_ids: correctIds,
  };
}

/**
 * Estado de cada lección para un estudiante. Dentro de cada profesor las
 * lecciones forman una sola fila (temas por posición, lecciones por posición):
 * la primera está disponible y cada una siguiente solo cuando la anterior ya
 * tiene un intento aprobado. Repetir una lección completada es siempre posible.
 */
export function buildRouteProgress(
  topics: RouteTopicRecord[],
  lessons: RouteLessonRecord[],
  attempts: RouteAttemptRecord[],
): RouteTopicProgress[] {
  const attemptsByLesson = new Map<string, RouteAttemptRecord[]>();
  for (const attempt of attempts) {
    const list = attemptsByLesson.get(attempt.lesson_id) ?? [];
    list.push(attempt);
    attemptsByLesson.set(attempt.lesson_id, list);
  }

  const orderedTopics = [...topics].sort((first, second) =>
    first.position - second.position || first.id.localeCompare(second.id)
  );
  const lessonsByTopic = new Map<string, RouteLessonRecord[]>();
  for (const lesson of lessons) {
    const list = lessonsByTopic.get(lesson.topic_id) ?? [];
    list.push(lesson);
    lessonsByTopic.set(lesson.topic_id, list);
  }

  const previousPassedByTeacher = new Map<string, boolean>();
  return orderedTopics.map((topic) => {
    const topicLessons = [...(lessonsByTopic.get(topic.id) ?? [])].sort(
      (first, second) =>
        first.position - second.position || first.id.localeCompare(second.id),
    );
    const progress: RouteLessonProgress[] = topicLessons.map((lesson) => {
      const lessonAttempts = attemptsByLesson.get(lesson.id) ?? [];
      const passed = lessonAttempts.some((attempt) => attempt.passed);
      const unlocked = previousPassedByTeacher.get(topic.teacher_id) ?? true;
      previousPassedByTeacher.set(topic.teacher_id, passed);
      return {
        ...lesson,
        status: passed ? "completed" : unlocked ? "available" : "locked",
        best_percent: lessonAttempts.length
          ? Math.max(...lessonAttempts.map((attempt) => attempt.score_percent))
          : null,
        attempts: lessonAttempts.length,
      };
    });
    return {
      ...topic,
      lessons: progress,
      completed_lessons: progress.filter((lesson) =>
        lesson.status === "completed"
      ).length,
    };
  });
}

function optionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return requiredString(value, field, 2000);
}

/** Valida las 5 preguntas de una lección (mismo formato que el modo normal). */
export function parseRouteQuestions(value: unknown): RouteQuestionInput[] {
  if (!Array.isArray(value) || value.length !== ROUTE_QUESTIONS_PER_LESSON) {
    throw new AppError(
      400,
      "validation_error",
      `questions must contain exactly ${ROUTE_QUESTIONS_PER_LESSON} items.`,
    );
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new AppError(
        400,
        "validation_error",
        `questions[${index}] must be an object.`,
      );
    }
    const input = entry as Record<string, unknown>;
    const label = `questions[${index}]`;
    const correct = requiredString(
      input.correct_option,
      `${label}.correct_option`,
      1,
    ).toUpperCase();
    return {
      statement: requiredString(input.statement, `${label}.statement`, 2000),
      option_a: requiredString(input.option_a, `${label}.option_a`, 1000),
      option_b: requiredString(input.option_b, `${label}.option_b`, 1000),
      option_c: requiredString(input.option_c, `${label}.option_c`, 1000),
      option_d: requiredString(input.option_d, `${label}.option_d`, 1000),
      correct_option: option(correct),
      explanation: optionalText(input.explanation, `${label}.explanation`),
    };
  });
}

/** Valida las respuestas de un intento: pregunta y opción, sin repetir preguntas. */
export function parseRouteAnswers(value: unknown): RouteAnswerInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new AppError(
      400,
      "validation_error",
      "answers must be a non-empty array.",
    );
  }
  const seen = new Set<string>();
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new AppError(
        400,
        "validation_error",
        "Each answer must be an object.",
      );
    }
    const input = entry as Record<string, unknown>;
    const questionId = uuid(input.question_id, "question_id");
    if (seen.has(questionId)) {
      throw new AppError(
        400,
        "duplicate_answer",
        "Each question can be submitted only once.",
      );
    }
    seen.add(questionId);
    return {
      question_id: questionId,
      selected_option: option(input.selected_option),
    };
  });
}

export function routeLessonText(value: unknown, field = "content_text") {
  return requiredString(value, field, ROUTE_LESSON_TEXT_MAX_LENGTH);
}
