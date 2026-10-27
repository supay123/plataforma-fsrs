import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile } from "../_shared/auth.ts";
import { RPCS, TABLES } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { scheduleAnswer } from "../_shared/fsrs.ts";
import type {
  FsrsConfig,
  StoredCard,
} from "../_shared/interfaces/fsrs.interfaces.ts";
import type { AnswerFeedback } from "../_shared/interfaces/session.interfaces.ts";
import { nonNegativeInteger, option, uuid } from "../_shared/validation.ts";
import type {
  AnswerQuestionBody,
  AnswerTarget,
  QuestionKey,
} from "./interfaces.ts";

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

// Provided by the Supabase Edge Runtime; the JSR typings do not declare it globally.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

// Attempts to persist an answer whose feedback was already sent.
const SAVE_ATTEMPTS = 3;

const CARD_COLUMNS =
  "due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,state,last_review_at";

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        // The session page calls GET when it opens so the worker is already
        // booted when the first answer arrives.
        if (request.method === "GET") return json({ status: "ready" });

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

        // Feedback latency is what the student waits for, so the profile check
        // and a single joined lookup (session, question key, FSRS config and
        // the student's card) run in parallel instead of five serial queries.
        const studentId = context.userClaims?.id ?? "";
        const [student, { data, error: targetError }] = await Promise.all([
          requireProfile(context, ["student"], true),
          context.supabaseAdmin
            .from(TABLES.assessmentSessionQuestions)
            .select(
              `id,selected_option,
              session:assessment_sessions!inner(id,student_id,status,fsrs_config:fsrs_configs(library_name,library_version,parameters)),
              question:questions!inner(correct_option,explanation,cards:student_question_cards(${CARD_COLUMNS}))`,
            )
            .eq("id", sessionQuestionId)
            .eq("question.cards.student_id", studentId)
            .maybeSingle(),
        ]);
        const target = data as AnswerTarget | null;
        if (
          targetError || !target || target.session.student_id !== student.id
        ) {
          throw new AppError(
            404,
            "question_not_found",
            "Session question not found.",
          );
        }
        const { session, question } = target;
        if (target.selected_option !== null) {
          // Retries must still receive the feedback for the stored answer.
          return json({
            status: "already_answered",
            session_id: session.id,
            selected_option: target.selected_option,
            feedback: feedbackFor(target.selected_option, question),
          });
        }
        if (session.status !== "in_progress") {
          throw new AppError(
            409,
            "session_not_active",
            "The session is not active.",
          );
        }
        if (!session.fsrs_config) {
          throw new AppError(
            500,
            "fsrs_config_failed",
            "FSRS config not found.",
          );
        }

        const reviewedAt = new Date();
        const nextCard = scheduleAnswer(
          (question.cards[0] ?? null) as StoredCard | null,
          session.fsrs_config as FsrsConfig,
          selectedOption === question.correct_option,
          reviewedAt,
        );
        // The student only waits for the feedback: the answer and the FSRS card
        // are saved after the response is sent. The RPC locks the row and
        // ignores a second answer, so a concurrent request cannot overwrite it.
        const save = async () => {
          for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt++) {
            const { error } = await context.supabaseAdmin.rpc(
              RPCS.applyAnswer,
              {
                p_student_id: student.id,
                p_session_question_id: sessionQuestionId,
                p_selected_option: selectedOption,
                // PostgreSQL permits NULL here, but generated RPC argument types
                // do not expose parameter nullability from the system catalog.
                p_response_time_ms: responseTime as number,
                p_reviewed_at: reviewedAt.toISOString(),
                p_card: nextCard,
              },
            );
            if (!error) return;
            if (attempt === SAVE_ATTEMPTS) {
              console.error("Answer save failed", sessionQuestionId, error);
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
          }
        };
        EdgeRuntime.waitUntil(save());

        return json({
          status: "accepted",
          session_id: session.id,
          selected_option: selectedOption,
          feedback: feedbackFor(selectedOption, question),
        });
      }),
  ),
};
