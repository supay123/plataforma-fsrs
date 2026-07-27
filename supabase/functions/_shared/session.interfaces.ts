export interface QuestionPayload {
  session_question_id: string;
  position: number;
  selection_reason: "due" | "new";
  selected_option: string | null;
  answered_at: string | null;
  question: {
    id: string;
    statement: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
  };
}
