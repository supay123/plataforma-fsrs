export interface CreateCourseBody {
  name?: unknown;
  description?: unknown;
  /** Solo lo exige el administrador; el profesor siempre crea en los suyos. */
  teacher_id?: unknown;
}

export interface UpdateCourseBody {
  name?: unknown;
  description?: unknown;
}

export interface CreateTopicBody {
  name?: unknown;
  description?: unknown;
  route_course_id?: unknown;
}

export interface UpdateTopicBody {
  name?: unknown;
  description?: unknown;
}

export interface CreateLessonBody {
  topic_id?: unknown;
  title?: unknown;
}

export interface RenameLessonBody {
  title?: unknown;
}

export interface ReplaceLessonContentBody {
  lesson?: unknown;
}

export interface SubmitAttemptBody {
  lesson_id?: unknown;
  answers?: unknown;
}
