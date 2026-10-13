import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile } from "../_shared/auth.ts";
import { RPCS, TABLES } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { scheduleAnswer } from "../_shared/fsrs.ts";
import type { FsrsConfig, StoredCard } from "../_shared/interfaces/fsrs.interfaces.ts";
import type { AnswerFeedback } from "../_shared/interfaces/session.interfaces.ts";
import { nonNegativeInteger, option, uuid } from "../_shared/validation.ts";
import type { AnswerQuestionBody } from "./interfaces.ts";

interface QuestionKey {
  correct_option: string;
  explanation: string | null;
}

function feedbackFor(
  selectedOption: string,
  question: QuestionKey,
): AnswerFeedback {
  return {
    is_correct: selectedOption === question.correct_option,
    correct_option: question.correct_option,
    explanation: question.explanation,
  };
}

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const student = await requireProfile(context, ["student"], true);
        const body = await readJson<AnswerQuestionBody>(request);
        const sessionQuestionId = uuid(
          body.session_question_id,
          "session_question_id",
        );
        const selectedOption = option(body.selected_option);
        const responseTime = nonNegativeInteger(
          body.response_time_ms,
          "response_time_ms",
        );

        const { data: sessionQuestion, error: sqError } = await context
          .supabaseAdmin
          .from(TABLES.assessmentSessionQuestions)
          .select("id,session_id,question_id,selected_option")
          .eq("id", sessionQuestionId)
          .maybeSingle();
        if (sqError || !sessionQuestion) {
          throw new AppError(
            404,
            "question_not_found",
            "Session question not found.",
          );
        }

        const { data: session, error: sessionError } = await context
          .supabaseAdmin
          .from(TABLES.assessmentSessions)
          .select("id,student_id,status,fsrs_config_id")
          .eq("id", sessionQuestion.session_id)
          .maybeSingle();
        if (sessionError || !session || session.student_id !== student.id) {
          throw new AppError(
            404,
            "question_not_found",
            "Session question not found.",
          );
        }
        if (sessionQuestion.selected_option !== null) {
          // Retries must still receive the feedback for the stored answer.
          const { data: question, error: questionError } = await context
            .supabaseAdmin
            .from(TABLES.questions)
            .select("correct_option,explanation")
            .eq("id", sessionQuestion.question_id)
            .single();
          if (questionError || !question) {
            throw new AppError(
              500,
              "question_lookup_failed",
              questionError?.message,
            );
          }
          return json({
            status: "already_answered",
            session_id: session.id,
            selected_option: sessionQuestion.selected_option,
            feedback: feedbackFor(sessionQuestion.selected_option, question),
          });
        }
        if (session.status !== "in_progress") {
          throw new AppError(
            409,
            "session_not_active",
            "The session is not active.",
          );
        }

        const [{ data: question, error: questionError }, {
          data: storedCard,
          error: cardError,
        }, { data: config, error: configError }] = await Promise.all([
          context.supabaseAdmin
            .from(TABLES.questions)
            .select("correct_option,explanation")
            .eq("id", sessionQuestion.question_id)
            .single(),
          context.supabaseAdmin
            .from(TABLES.studentQuestionCards)
            .select(
              "due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,state,last_review_at",
            )
            .eq("student_id", student.id)
            .eq("question_id", sessionQuestion.question_id)
            .maybeSingle(),
          context.supabaseAdmin
            .from(TABLES.fsrsConfigs)
            .select("library_name,library_version,parameters")
            .eq("id", session.fsrs_config_id)
            .single(),
        ]);
        if (questionError || !question) {
          throw new AppError(
            500,
            "question_lookup_failed",
            questionError?.message,
          );
        }
        if (cardError) {
          throw new AppError(500, "card_lookup_failed", cardError.message);
        }
        if (configError || !config) {
          throw new AppError(500, "fsrs_config_failed", configError?.message);
        }

        const reviewedAt = new Date();
        const nextCard = scheduleAnswer(
          storedCard as StoredCard | null,
          config as FsrsConfig,
          selectedOption === question.correct_option,
          reviewedAt,
        );
        const { data: result, error: answerError } = await context.supabaseAdmin
          .rpc(RPCS.applyAnswer, {
            p_student_id: student.id,
            p_session_question_id: sessionQuestionId,
            p_selected_option: selectedOption,
            // PostgreSQL permits NULL here, but generated RPC argument types do
            // not expose parameter nullability from the system catalog.
            p_response_time_ms: responseTime as number,
            p_reviewed_at: reviewedAt.toISOString(),
            p_card: nextCard,
          });
        if (answerError) {
          throw new AppError(400, "answer_failed", answerError.message);
        }

        // A concurrent request may have stored a different option first; the
        // feedback must describe the answer that was actually persisted.
        let storedOption: string = selectedOption;
        if (
          (result as { status?: string } | null)?.status === "already_answered"
        ) {
          const { data: stored, error: storedError } = await context
            .supabaseAdmin
            .from(TABLES.assessmentSessionQuestions)
            .select("selected_option")
            .eq("id", sessionQuestionId)
            .single();
          if (storedError || !stored?.selected_option) {
            throw new AppError(
              500,
              "answer_lookup_failed",
              storedError?.message ?? "Stored answer not found.",
            );
          }
          storedOption = stored.selected_option;
        }
        return json({
          ...(result as Record<string, unknown>),
          selected_option: storedOption,
          feedback: feedbackFor(storedOption, question),
        });
      }),
  ),
};
