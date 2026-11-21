export type RouteLessonStatus = "locked" | "available" | "completed";

export interface RouteTopicRecord {
  id: string;
  teacher_id: string;
  name: string;
  description: string | null;
  position: number;
}

export interface RouteLessonRecord {
  id: string;
  topic_id: string;
  position: number;
  title: string;
}

export interface RouteAttemptRecord {
  lesson_id: string;
  score_percent: number;
  passed: boolean;
}

export interface RouteLessonProgress extends RouteLessonRecord {
  status: RouteLessonStatus;
  best_percent: number | null;
  attempts: number;
}

export interface RouteTopicProgress extends RouteTopicRecord {
  lessons: RouteLessonProgress[];
  completed_lessons: number;
}

export interface RouteQuestionInput {
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string | null;
}

export interface RouteLessonContent {
  content_text: string;
  questions_to_show: number;
  questions: RouteQuestionInput[];
}

export interface RouteAnswerInput {
  question_id: string;
  selected_option: "A" | "B" | "C" | "D";
}

export interface RouteGradingKey {
  id: string;
  correct_option: string;
}

export interface RouteGrading {
  total_questions: number;
  correct_count: number;
  score_percent: number;
  passed: boolean;
  correct_question_ids: string[];
}
