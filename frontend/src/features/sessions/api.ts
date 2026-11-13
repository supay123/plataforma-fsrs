import { invokeFunction } from "../../lib/api/functions";
import type { PracticePayload, ReviewResponse, SessionAnswer, SessionSummary, XpAward, XpRules } from "../../types/contracts";
/** Reanuda o crea la sesión del tema; trae las preguntas y su clave de respuestas cifrada. */
export const startPractice = (topic_id: string) => invokeFunction<PracticePayload, { topic_id: string }>("practice-session/start", { topic_id });
/** Guarda todas las respuestas pendientes de una vez y cierra la sesión. */
export const submitPractice = (session_id: string, answers: SessionAnswer[]) => invokeFunction<
  { session: SessionSummary; xp?: XpAward; request_id?: string },
  { session_id: string; answers: SessionAnswer[] }
>("practice-session/submit", { session_id, answers });
/** Montos de xp del colegio y nivel actual, para mostrar el xp que gana con cada respuesta. */
export const getXpRules = () => invokeFunction<XpRules, Record<string, never>>("practice-session/xp-rules", {}, { method: "GET" });
export const getSessionReview = (session_id: string) => invokeFunction<ReviewResponse, { session_id: string }>("get-session-review", { session_id });
