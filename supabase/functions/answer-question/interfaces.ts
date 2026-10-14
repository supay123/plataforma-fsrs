export interface AnswerQuestionBody {
  session_question_id?: unknown;
  selected_option?: unknown;
  response_time_ms?: unknown;
}

export interface QuestionKey {
  correct_option: string;
  explanation: string | null;
}

export interface AnswerTarget {
  id: string;
  selected_option: string | null;
  session: {
    id: string;
    student_id: string;
    status: string;
    fsrs_config: unknown;
  };
  question: QuestionKey & { cards: unknown[] };
}
