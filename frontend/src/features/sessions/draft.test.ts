import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllSessionDrafts,
  loadSessionDraft,
  saveSessionDraft,
  toSubmittedAnswers,
} from "./draft";

describe("session drafts", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("isolates drafts by user and session and ignores unknown questions", () => {
    saveSessionDraft("user-1", "session-1", {
      "question-1": { selected_option: "B", response_time_ms: 450 },
      unknown: { selected_option: "A", response_time_ms: 1 },
    });
    expect(loadSessionDraft("user-1", "session-1", ["question-1"])).toEqual({
      "question-1": { selected_option: "B", response_time_ms: 450 },
    });
    expect(loadSessionDraft("user-2", "session-1", ["question-1"])).toEqual({});
  });

  it("maps and clears persisted answers", () => {
    const answers = { question: { selected_option: "C" as const, response_time_ms: 900 } };
    saveSessionDraft("user", "session", answers);
    expect(toSubmittedAnswers(answers)).toEqual([{
      session_question_id: "question",
      selected_option: "C",
      response_time_ms: 900,
    }]);
    clearAllSessionDrafts();
    expect(loadSessionDraft("user", "session", ["question"])).toEqual({});
  });
});
