export interface StartPracticeBody {
  topic_id?: unknown;
}

export interface SubmitPracticeBody {
  session_id?: unknown;
  answers?: unknown;
}

export interface SubmittedAnswer {
  session_question_id: string;
  selected_option: "A" | "B" | "C" | "D";
  response_time_ms: number;
}
