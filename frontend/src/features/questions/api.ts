import { invokeFunction } from "../../lib/api/functions";
import type { ImportResponse, TopicQuestion } from "../../types/contracts";

export async function importQuestions(body: { action: "validate" | "confirm"; topic_id: string; filename: string; file_base64: string }) { return invokeFunction<ImportResponse, typeof body>("import-questions", body); }
export async function fileToBase64(file: File) { const buffer = await file.arrayBuffer(); let binary = ""; for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte); return btoa(binary); }

/** GET /questions?topic_id=...: preguntas vigentes del tema (puede devolver una lista vacía). */
export async function listTopicQuestions(topicId: string) {
  const { questions } = await invokeFunction<{ questions: TopicQuestion[] }, Record<string, never>>(
    `questions?topic_id=${encodeURIComponent(topicId)}`, {}, { method: "GET" },
  );
  return questions;
}

/** DELETE /questions?id=...: archiva una pregunta del tema. */
export function deleteQuestion(questionId: string) {
  return invokeFunction<{ question_id: string }, Record<string, never>>(
    `questions?id=${encodeURIComponent(questionId)}`, {}, { method: "DELETE" },
  );
}

/** DELETE /questions/topic?topic_id=...: archiva todas las preguntas del tema. */
export function deleteAllTopicQuestions(topicId: string) {
  return invokeFunction<{ topic_id: string; archived: number }, Record<string, never>>(
    `questions/topic?topic_id=${encodeURIComponent(topicId)}`, {}, { method: "DELETE" },
  );
}
