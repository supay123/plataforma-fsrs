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
export interface TopicQuestion {
  id: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: AnswerOption;
  explanation: string | null;
  created_at: string;
}

export interface AnswerFeedback { is_correct: boolean; correct_option: AnswerOption; explanation: string | null }
export interface SessionQuestion {
  session_question_id: string;
  position: number;
  selection_reason: "due" | "new" | "scheduled";
  selected_option: AnswerOption | null;
  answered_at: string | null;
  /** Only present once the question has been answered. */
  feedback: AnswerFeedback | null;
  question: { id: string; statement: string; option_a: string; option_b: string; option_c: string; option_d: string };
}
export interface SessionPayload {
  session: {
    id: string; course_id: string; topic_id: string; status: "in_progress";
    started_at: string; total_questions: number; answered_questions: number;
  };
  questions: SessionQuestion[];
}
/** Lo que el navegador necesita para corregir una pregunta sin llamar al servidor. */
export interface AnswerKeyEntry { correct_option: AnswerOption; explanation: string | null }
/** Clave de respuestas cifrada con AES-GCM, indexada por session_question_id. */
export interface EncryptedAnswerKey {
  algorithm: "AES-GCM";
  /** Llave AES de 256 bits en base64. */
  key: string;
  items: Record<string, { iv: string; data: string }>;
}
export interface PracticePayload extends SessionPayload { answer_key: EncryptedAnswerKey }
export interface SessionSummary {
  session_id: string; student_id: string; student_name: string; course_id: string;
  course_name: string; topic_id: string; topic_name: string; status: string;
  started_at: string; completed_at: string | null; total_questions: number;
  answered_questions: number; correct_count: number; incorrect_count: number;
  correct_percentage: number | null; error_percentage: number | null;
}
/** Montos de xp del colegio y nivel actual del estudiante (GET practice-session/xp-rules). */
export interface XpRules {
  xp_per_correct: number; streak_3_bonus: number; streak_7_bonus: number; streak_20_bonus: number;
  level: number; xp: number; xp_to_next: number;
}
export interface XpBreakdown {
  total: number; correct_xp: number; streak_bonuses: Array<{ streak: number; xp: number }>;
}
/** Xp otorgado al cerrar la sesión. `thresholds` trae el costo de cada nivel que cruzó. */
export interface XpAward {
  xp_gained: number; level_before: number; xp_before: number; level: number; xp: number;
  thresholds: number[]; breakdown: XpBreakdown;
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
