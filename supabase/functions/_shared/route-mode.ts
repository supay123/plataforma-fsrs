import { AppError } from "./errors.ts";
import type {
  RouteAnswerInput,
  RouteAttemptRecord,
  RouteGrading,
  RouteGradingKey,
  RouteLessonContent,
  RouteLessonProgress,
  RouteLessonRecord,
  RouteQuestionInput,
  RouteTopicProgress,
  RouteTopicRecord,
} from "./interfaces/route-mode.interfaces.ts";
import { option, requiredString, uuid } from "./validation.ts";

export const ROUTE_PASS_PERCENT = 80;
export const ROUTE_MAX_QUESTIONS_PER_LESSON = 100;
export const ROUTE_LESSON_TEXT_MAX_LENGTH = 50000;

/** Porcentaje entero (hacia abajo) de aciertos: 4 de 5 es 80. */
export function routeScorePercent(correct: number, total: number): number {
  return total <= 0 ? 0 : Math.floor((correct * 100) / total);
}

/**
 * Califica un intento con la clave de la base de datos. El estudiante responde
 * exactamente `expectedCount` preguntas distintas, todas del banco de la lección.
 */
export function gradeRouteAttempt(
  key: RouteGradingKey[],
  answers: RouteAnswerInput[],
  expectedCount: number,
): RouteGrading {
  const correctOptionById = new Map(
    key.map((question) => [question.id, question.correct_option.trim()]),
  );
  if (
    answers.length !== expectedCount ||
    answers.some((answer) => !correctOptionById.has(answer.question_id))
  ) {
    throw new AppError(
      409,
      "incomplete_submission",
      `Exactly ${expectedCount} questions of the lesson must be answered, each once.`,
    );
  }
  const correctIds = answers
    .filter((answer) =>
      answer.selected_option === correctOptionById.get(answer.question_id)
    )
    .map((answer) => answer.question_id);
  const percent = routeScorePercent(correctIds.length, expectedCount);
  return {
    total_questions: expectedCount,
    correct_count: correctIds.length,
    score_percent: percent,
    passed: percent >= ROUTE_PASS_PERCENT,
    correct_question_ids: correctIds,
  };
}

/** Sortea `count` preguntas del banco sin repetir (Fisher-Yates). */
export function pickRandomQuestions<Question>(
  bank: Question[],
  count: number,
  random: () => number = Math.random,
): Question[] {
  const shuffled = [...bank];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!];
  }
  return shuffled.slice(0, count);
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

function correctOption(value: string, field: string): "A" | "B" | "C" | "D" {
  if (value !== "A" && value !== "B" && value !== "C" && value !== "D") {
    throw new AppError(
      400,
      "validation_error",
      `${field} must be A, B, C, or D.`,
    );
  }
  return value;
}

function parseRouteQuestionBank(
  value: unknown,
  path: string,
): RouteQuestionInput[] {
  if (
    !Array.isArray(value) || value.length === 0 ||
    value.length > ROUTE_MAX_QUESTIONS_PER_LESSON
  ) {
    throw new AppError(
      400,
      "validation_error",
      `${path} must contain between 1 and ${ROUTE_MAX_QUESTIONS_PER_LESSON} questions.`,
    );
  }
  return value.map((entry, index) => {
    const label = `${path}[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new AppError(
        400,
        "validation_error",
        `${label} must be an object.`,
      );
    }
    const input = entry as Record<string, unknown>;
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
      correct_option: correctOption(correct, `${label}.correct_option`),
      explanation: optionalText(input.explanation, `${label}.explanation`),
    };
  });
}

/**
 * Valida el JSON del contenido de una lección: texto, banco de preguntas y
 * cuántas se muestran por intento (nunca más que el banco). El título no va
 * en el JSON: es el nombre con el que se creó la lección.
 */
export function parseRouteLessonContent(value: unknown): RouteLessonContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(400, "validation_error", "lesson must be an object.");
  }
  const input = value as Record<string, unknown>;
  const questions = parseRouteQuestionBank(input.questions, "lesson.questions");
  const toShow = input.questions_to_show;
  if (
    typeof toShow !== "number" || !Number.isInteger(toShow) || toShow < 1 ||
    toShow > questions.length
  ) {
    throw new AppError(
      400,
      "validation_error",
      `lesson.questions_to_show must be an integer between 1 and the number of questions (${questions.length}).`,
    );
  }
  return {
    content_text: routeLessonText(input.text, "lesson.text"),
    questions_to_show: toShow,
    questions,
  };
}

/** Valida las respuestas de un intento: pregunta y opción, sin repetir preguntas. */
export function parseRouteAnswers(value: unknown): RouteAnswerInput[] {
  if (
    !Array.isArray(value) || value.length === 0 ||
    value.length > ROUTE_MAX_QUESTIONS_PER_LESSON
  ) {
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
