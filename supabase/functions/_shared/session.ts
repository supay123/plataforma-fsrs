import type { QuestionPayload } from "./session.interfaces.ts";
import type { AppProfile, EdgeContext } from "./types.ts";
import { TABLES } from "./database.constants.ts";
import { AppError } from "./errors.ts";

export async function sessionPayload(
  context: EdgeContext,
  profile: AppProfile,
  sessionId: string,
): Promise<Record<string, unknown>> {
  const { data: session, error: sessionError } = await context.supabaseAdmin
    .from(TABLES.assessmentSessions)
    .select(
      "id,student_id,course_id,topic_id,status,started_at,total_questions,answered_questions",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    throw new AppError(500, "session_lookup_failed", sessionError.message);
  }
  if (!session || session.student_id !== profile.id) {
    throw new AppError(404, "session_not_found", "Session not found.");
  }
  if (session.status !== "in_progress") {
    throw new AppError(
      409,
      "session_not_active",
      "The session is not in progress.",
    );
  }

  const { data: rows, error: questionError } = await context.supabaseAdmin
    .from(TABLES.assessmentSessionQuestions)
    .select(
      "id,position,selection_reason,selected_option,answered_at,questions!inner(id,statement,option_a,option_b,option_c,option_d)",
    )
    .eq("session_id", sessionId)
    .order("position");

  if (questionError) {
    throw new AppError(500, "session_questions_failed", questionError.message);
  }

  const questions: QuestionPayload[] = (rows ?? []).map((row) => {
    const nested = Array.isArray(row.questions)
      ? row.questions[0]
      : row.questions;
    return {
      session_question_id: row.id,
      position: row.position,
      selection_reason: row.selection_reason,
      selected_option: row.selected_option,
      answered_at: row.answered_at,
      question: nested,
    } as QuestionPayload;
  });

  return {
    session: {
      id: session.id,
      course_id: session.course_id,
      topic_id: session.topic_id,
      status: session.status,
      started_at: session.started_at,
      total_questions: session.total_questions,
      answered_questions: session.answered_questions,
    },
    questions,
  };
}
