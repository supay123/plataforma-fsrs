export interface AnswerFeedback {
  is_correct: boolean;
  correct_option: string;
  explanation: string | null;
}

export interface QuestionPayload {
  session_question_id: string;
  position: number;
  selection_reason: "due" | "new" | "scheduled";
  selected_option: string | null;
  answered_at: string | null;
  // Present only once the question has been answered, so pending questions
  // never expose their correct option or explanation.
  feedback: AnswerFeedback | null;
  question: {
    id: string;
    statement: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
  };
}
