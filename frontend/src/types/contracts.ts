import type { Enums, Tables } from "./database";

export type AppRole = Enums<"app_user_role">;
export type Profile = Pick<Tables<"profiles">, "id" | "college_id" | "role" | "user_code" | "full_name" | "is_active" | "access_valid_from" | "access_valid_until" | "security_question">;
export type AnswerOption = "A" | "B" | "C" | "D";

export interface AppFunctionError {
  error: { code: string; message: string; details?: unknown };
}

export interface LoginResponse {
  session: { access_token: string; refresh_token: string; expires_at?: number };
  user: { id: string; code: string; full_name: string; role: AppRole; college_id: string | null };
}

export interface Credentials { user_code: string; temporary_password?: string }
export interface UserMutationResponse { user?: Profile; student?: Profile; user_id?: string; credentials?: Credentials }
export interface SecurityQuestionResponse { security_question: string }
export interface CredentialsResponse { credentials: Credentials }

export interface ImportRow {
  pregunta: string; respuesta_a: string; respuesta_b: string; respuesta_c: string;
  respuesta_d: string; respuesta_correcta: AnswerOption; explicacion?: string;
}
export interface ImportIssue { row: number; code: string; message: string }
export interface ImportReport { total: number; accepted: number; rejected: number; duplicates: number; issues: ImportIssue[] }
export interface ImportResponse { batch_id?: string; report: ImportReport; accepted_rows?: ImportRow[] }

export interface SessionQuestion {
  session_question_id: string;
  position: number;
  selection_reason: "due" | "new" | "scheduled";
  selected_option: AnswerOption | null;
  answered_at: string | null;
  question: { id: string; statement: string; option_a: string; option_b: string; option_c: string; option_d: string };
}
export interface SessionPayload {
  session: {
    id: string; course_id: string; topic_id: string; status: "in_progress";
    started_at: string; total_questions: number; answered_questions: number;
  };
  questions: SessionQuestion[];
}
export interface SessionSummary {
  session_id: string; student_id: string; student_name: string; course_id: string;
  course_name: string; topic_id: string; topic_name: string; status: string;
  started_at: string; completed_at: string | null; total_questions: number;
  answered_questions: number; correct_count: number; incorrect_count: number;
  correct_percentage: number | null; error_percentage: number | null;
}
export interface ReviewQuestion {
  position: number; statement: string; option_a: string; option_b: string;
  option_c: string; option_d: string; selected_option: AnswerOption;
  correct_option: AnswerOption; explanation: string | null; is_correct: boolean;
}
export interface ReviewResponse { session: SessionSummary; questions: ReviewQuestion[] }

export interface SessionAnswer {
  session_question_id: string;
  selected_option: AnswerOption;
  response_time_ms: number;
}
