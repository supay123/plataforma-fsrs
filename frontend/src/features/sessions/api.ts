import { invokeFunction } from "../../lib/api/functions";
import type { AnswerOption, ReviewResponse, SessionAnswer, SessionPayload, SessionSummary } from "../../types/contracts";
export const startSession = (topic_id: string) => invokeFunction<SessionPayload, { topic_id: string }>("start-session", { topic_id });
export const getSession = (session_id: string) => invokeFunction<SessionPayload, { session_id: string }>("get-session", { session_id });
export const answerQuestion = (body: { session_question_id: string; selected_option: AnswerOption; response_time_ms: number }) => invokeFunction<{ status: string; session_id: string }, typeof body>("answer-question", body);
export const completeSession = (session_id: string, answers?: SessionAnswer[]) => invokeFunction<
  { session: SessionSummary; request_id?: string },
  { session_id: string; answers?: SessionAnswer[] }
>("complete-session", answers === undefined ? { session_id } : { session_id, answers });
export const getSessionReview = (session_id: string) => invokeFunction<ReviewResponse, { session_id: string }>("get-session-review", { session_id });
