export interface CreateTopicBody {
  name?: unknown;
  description?: unknown;
  /** Solo lo exige el administrador; el profesor siempre crea en su grupo. */
  teacher_id?: unknown;
}

export interface UpdateTopicBody {
  name?: unknown;
  description?: unknown;
}

export interface CreateLessonBody {
  topic_id?: unknown;
  title?: unknown;
  content_text?: unknown;
}

export interface UpdateLessonBody {
  title?: unknown;
  content_text?: unknown;
}

export interface SaveLessonQuestionsBody {
  questions?: unknown;
}

export interface SubmitAttemptBody {
  lesson_id?: unknown;
  answers?: unknown;
}
