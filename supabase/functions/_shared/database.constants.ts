export const TABLES = {
  assessmentSessionQuestions: "assessment_session_questions",
  assessmentSessions: "assessment_sessions",
  auditLogs: "audit_logs",
  colleges: "colleges",
  courseEnrollments: "course_enrollments",
  courses: "courses",
  fsrsConfigs: "fsrs_configs",
  fsrsReviewLogs: "fsrs_review_logs",
  profiles: "profiles",
  questionImportBatches: "question_import_batches",
  questions: "questions",
  studentQuestionCards: "student_question_cards",
  studentTopicAccess: "student_topic_access",
  topics: "topics",
} as const;

export const VIEWS = {
  completedSessionReview: "v_completed_session_review",
  exportAllData: "v_export_all_data",
  sessionResults: "v_session_results",
  studentCourseProgress: "v_student_course_progress",
  studentTopicAccessStatus: "v_student_topic_access_status",
  studentTopicProgress: "v_student_topic_progress",
  teacherStudents: "v_teacher_students",
} as const;

export const RPCS = {
  applyAnswer: "edge_apply_answer",
  completeSession: "edge_complete_session",
  findProfileByCode: "edge_find_profile_by_code",
  importQuestions: "edge_import_questions",
  startSession: "edge_start_session",
  submitAndCompleteSession: "edge_submit_and_complete_session",
} as const;
