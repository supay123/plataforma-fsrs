export interface TopicProgressRow {
  topic_id: string | null;
  topic_name: string | null;
  course_name: string | null;
  correct_percentage: number | null;
  answered_questions: number | null;
}

export interface TopicAccessRow {
  topic_id: string | null;
  is_blocked: boolean | null;
}

export interface TopicDueReviewRow {
  topic_id: string | null;
  topic_name: string | null;
  course_name: string | null;
  due_questions: number | null;
  oldest_due_at: string | null;
}

export interface StrongestTopic {
  topicId: string;
  topicName: string;
  percentage: number;
}

export interface TopicToReview {
  topicId: string;
  topicName: string;
  courseName: string;
  dueQuestions: number;
}

/** El tema practicado con mayor acierto (no bloqueado). */
export function strongestTopic(progress: readonly TopicProgressRow[], access: readonly TopicAccessRow[]): StrongestTopic | undefined {
  const blocked = new Set(access.filter((row) => row.is_blocked).map((row) => row.topic_id));
  return progress
    .filter((row) => row.topic_id && row.correct_percentage !== null && !blocked.has(row.topic_id))
    .map((row) => ({ topicId: row.topic_id!, topicName: row.topic_name ?? "", percentage: Number(row.correct_percentage) }))
    .sort((a, b) => b.percentage - a.percentage)[0];
}

/** Temas con preguntas vencidas según FSRS y no bloqueados; primero los de la pregunta más atrasada. */
export function topicsToReview(dueReviews: readonly TopicDueReviewRow[], access: readonly TopicAccessRow[]): TopicToReview[] {
  const blocked = new Set(access.filter((row) => row.is_blocked).map((row) => row.topic_id));
  return dueReviews
    .filter((row) => row.topic_id && Number(row.due_questions) > 0 && !blocked.has(row.topic_id))
    .sort((a, b) => (a.oldest_due_at ?? "").localeCompare(b.oldest_due_at ?? ""))
    .map((row) => ({ topicId: row.topic_id!, topicName: row.topic_name ?? "", courseName: row.course_name ?? "", dueQuestions: Number(row.due_questions) }));
}
