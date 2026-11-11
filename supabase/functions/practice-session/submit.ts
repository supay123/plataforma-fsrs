import { requireProfile } from "../_shared/auth.ts";
import { RPCS, TABLES, VIEWS } from "../_shared/database.constants.ts";
import type { Json } from "../_shared/database.types.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { scheduleAnswer } from "../_shared/fsrs.ts";
import type {
  FsrsConfig,
  StoredCard,
} from "../_shared/interfaces/fsrs.interfaces.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { nonNegativeInteger, option, uuid } from "../_shared/validation.ts";
import type { SubmitPracticeBody, SubmittedAnswer } from "./interfaces.ts";

function parseAnswers(value: unknown): SubmittedAnswer[] {
  if (!Array.isArray(value) || value.length > 20) {
    throw new AppError(
      400,
      "validation_error",
      "answers must be an array with at most 20 items.",
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
    const sessionQuestionId = uuid(
      input.session_question_id,
      "session_question_id",
    );
    if (seen.has(sessionQuestionId)) {
      throw new AppError(
        400,
        "duplicate_answer",
        "Each question can be submitted only once.",
      );
    }
    seen.add(sessionQuestionId);
    const responseTime = nonNegativeInteger(
      input.response_time_ms,
      "response_time_ms",
    );
    if (responseTime === null) {
      throw new AppError(
        400,
        "validation_error",
        "response_time_ms is required.",
      );
    }
    return {
      session_question_id: sessionQuestionId,
      selected_option: option(input.selected_option),
      response_time_ms: responseTime,
    };
  });
}

/**
 * Guarda de una vez todas las respuestas pendientes de la sesión, aplica FSRS
 * con la clave de la base de datos (nunca con la corrección del navegador) y
 * cierra la sesión. Reenviar una sesión ya cerrada devuelve su resultado.
 */
export async function submitPractice(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"], true);
  const body = await readJson<SubmitPracticeBody>(request);
  const sessionId = uuid(body.session_id, "session_id");
  const answers = parseAnswers(body.answers);
  const requestId = request.headers.get("x-client-request-id") ??
    crypto.randomUUID();

  const { data: session, error: sessionError } = await context.supabaseAdmin
    .from(TABLES.assessmentSessions)
    .select("id,student_id,status,fsrs_config_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError || !session || session.student_id !== student.id) {
    throw new AppError(404, "session_not_found", "Session not found.");
  }

  let results: Array<Record<string, Json | undefined>> = [];
  if (session.status === "in_progress") {
    const { data: rows, error: rowsError } = await context.supabaseAdmin
      .from(TABLES.assessmentSessionQuestions)
      .select("id,question_id,selected_option,questions!inner(correct_option)")
      .eq("session_id", sessionId);
    if (rowsError) {
      throw new AppError(500, "session_questions_failed", rowsError.message);
    }

    const unanswered = (rows ?? []).filter((row) =>
      row.selected_option === null
    );
    const answersById = new Map(
      answers.map((answer) => [answer.session_question_id, answer]),
    );
    if (
      unanswered.length !== answers.length ||
      unanswered.some((row) => !answersById.has(row.id))
    ) {
      throw new AppError(
        409,
        "incomplete_submission",
        "Every unanswered question must be submitted exactly once.",
      );
    }

    const questionIds = unanswered.map((row) => row.question_id);
    const [{ data: config, error: configError }, cardsResult] = await Promise
      .all([
        context.supabaseAdmin
          .from(TABLES.fsrsConfigs)
          .select("library_name,library_version,parameters")
          .eq("id", session.fsrs_config_id)
          .single(),
        questionIds.length
          ? context.supabaseAdmin
            .from(TABLES.studentQuestionCards)
            .select(
              "question_id,due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,state,last_review_at",
            )
            .eq("student_id", student.id)
            .in("question_id", questionIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
    if (configError || !config) {
      throw new AppError(500, "fsrs_config_failed", configError?.message);
    }
    if (cardsResult.error) {
      throw new AppError(
        500,
        "card_lookup_failed",
        cardsResult.error.message,
      );
    }

    const cards = new Map(
      (cardsResult.data ?? []).map((card) => [
        card.question_id,
        card as StoredCard,
      ]),
    );
    const reviewedAt = new Date();
    results = unanswered.map((row) => {
      const answer = answersById.get(row.id)!;
      const question = Array.isArray(row.questions)
        ? row.questions[0]
        : row.questions;
      if (!question) {
        throw new AppError(
          500,
          "question_lookup_failed",
          "Question not found.",
        );
      }
      return {
        session_question_id: row.id,
        selected_option: answer.selected_option,
        response_time_ms: answer.response_time_ms,
        reviewed_at: reviewedAt.toISOString(),
        card: scheduleAnswer(
          cards.get(row.question_id) ?? null,
          config as FsrsConfig,
          answer.selected_option === question.correct_option,
          reviewedAt,
        ),
      };
    });
  }

  const { data: completedId, error: completionError } = await context
    .supabaseAdmin
    .rpc(RPCS.submitAndCompleteSession, {
      p_student_id: student.id,
      p_session_id: sessionId,
      p_results: results as Json,
    });
  if (completionError || typeof completedId !== "string") {
    throw new AppError(
      400,
      "session_completion_failed",
      completionError?.message ?? "Unable to complete session.",
    );
  }

  console.info(
    JSON.stringify({
      event: "session.completed",
      request_id: requestId,
      session_id: completedId,
    }),
  );

  const { data: result, error: resultError } = await context.supabaseAdmin
    .from(VIEWS.sessionResults)
    .select("*")
    .eq("session_id", completedId)
    .single();
  if (resultError) {
    throw new AppError(500, "session_result_failed", resultError.message);
  }
  return json({ session: result, request_id: requestId });
}
