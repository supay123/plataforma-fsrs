import type { AnswerOption, SessionAnswer } from "../../types/contracts";

const PREFIX = "fsrs-session-draft:v1:";

export type SessionDraftAnswers = Record<string, Pick<SessionAnswer, "selected_option" | "response_time_ms">>;

function key(userId: string, sessionId: string): string {
  return `${PREFIX}${userId}:${sessionId}`;
}

export function loadSessionDraft(
  userId: string,
  sessionId: string,
  validQuestionIds: readonly string[],
): SessionDraftAnswers {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(key(userId, sessionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { answers?: Record<string, { selected_option?: unknown; response_time_ms?: unknown }> };
    const valid = new Set(validQuestionIds);
    return Object.fromEntries(
      Object.entries(parsed.answers ?? {}).filter((entry): entry is [string, { selected_option: AnswerOption; response_time_ms: number }] => {
        const [id, answer] = entry;
        return valid.has(id) &&
          ["A", "B", "C", "D"].includes(String(answer.selected_option)) &&
          Number.isInteger(answer.response_time_ms) && Number(answer.response_time_ms) >= 0;
      }),
    );
  } catch {
    return {};
  }
}

export function saveSessionDraft(userId: string, sessionId: string, answers: SessionDraftAnswers): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key(userId, sessionId), JSON.stringify({ version: 1, answers }));
}

export function clearSessionDraft(userId: string, sessionId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key(userId, sessionId));
}

export function clearAllSessionDrafts(): void {
  if (typeof window === "undefined") return;
  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const storageKey = window.sessionStorage.key(index);
    if (storageKey?.startsWith(PREFIX)) window.sessionStorage.removeItem(storageKey);
  }
}

export function toSubmittedAnswers(answers: SessionDraftAnswers): SessionAnswer[] {
  return Object.entries(answers).map(([session_question_id, answer]) => ({
    session_question_id,
    ...answer,
  }));
}
