-- User removal starts at auth.users. The existing profiles_id_fkey already
-- cascades from auth.users to public.profiles; the constraints below continue
-- that cascade through every academic record owned by or associated with the
-- profile.

alter table public.assessment_sessions
  drop constraint assessment_sessions_student_id_fkey,
  add constraint assessment_sessions_student_id_fkey
    foreign key (student_id) references public.profiles(id) on delete cascade;

alter table public.audit_logs
  drop constraint audit_logs_actor_user_id_fkey,
  add constraint audit_logs_actor_user_id_fkey
    foreign key (actor_user_id) references public.profiles(id) on delete cascade;

alter table public.course_enrollments
  drop constraint course_enrollments_enrolled_by_fkey,
  add constraint course_enrollments_enrolled_by_fkey
    foreign key (enrolled_by) references public.profiles(id) on delete cascade,
  drop constraint course_enrollments_student_id_fkey,
  add constraint course_enrollments_student_id_fkey
    foreign key (student_id) references public.profiles(id) on delete cascade;

alter table public.courses
  drop constraint courses_created_by_fkey,
  add constraint courses_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete cascade,
  drop constraint courses_teacher_id_fkey,
  add constraint courses_teacher_id_fkey
    foreign key (teacher_id) references public.profiles(id) on delete cascade;

alter table public.fsrs_review_logs
  drop constraint fsrs_review_logs_student_id_fkey,
  add constraint fsrs_review_logs_student_id_fkey
    foreign key (student_id) references public.profiles(id) on delete cascade;

alter table public.profiles
  drop constraint profiles_created_by_fkey,
  add constraint profiles_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete cascade;

alter table public.question_import_batches
  drop constraint question_import_batches_uploaded_by_fkey,
  add constraint question_import_batches_uploaded_by_fkey
    foreign key (uploaded_by) references public.profiles(id) on delete cascade;

alter table public.questions
  drop constraint questions_created_by_fkey,
  add constraint questions_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete cascade;

alter table public.student_topic_access
  drop constraint student_topic_access_updated_by_fkey,
  add constraint student_topic_access_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete cascade;

alter table public.topics
  drop constraint topics_created_by_fkey,
  add constraint topics_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete cascade;

-- Cascades through the academic hierarchy ensure that deleting a teacher or a
-- college removes courses and all dependent learning records.

alter table public.course_enrollments
  drop constraint course_enrollments_course_id_fkey,
  add constraint course_enrollments_course_id_fkey
    foreign key (course_id) references public.courses(id) on delete cascade;

alter table public.topics
  drop constraint topics_course_id_fkey,
  add constraint topics_course_id_fkey
    foreign key (course_id) references public.courses(id) on delete cascade;

alter table public.assessment_sessions
  drop constraint assessment_sessions_course_id_fkey,
  add constraint assessment_sessions_course_id_fkey
    foreign key (course_id) references public.courses(id) on delete cascade,
  drop constraint assessment_sessions_topic_id_fkey,
  add constraint assessment_sessions_topic_id_fkey
    foreign key (topic_id) references public.topics(id) on delete cascade;

alter table public.question_import_batches
  drop constraint question_import_batches_topic_id_fkey,
  add constraint question_import_batches_topic_id_fkey
    foreign key (topic_id) references public.topics(id) on delete cascade;

alter table public.questions
  drop constraint questions_topic_id_fkey,
  add constraint questions_topic_id_fkey
    foreign key (topic_id) references public.topics(id) on delete cascade;

alter table public.assessment_session_questions
  drop constraint assessment_session_questions_question_id_fkey,
  add constraint assessment_session_questions_question_id_fkey
    foreign key (question_id) references public.questions(id) on delete cascade;

alter table public.student_question_cards
  drop constraint student_question_cards_question_id_fkey,
  add constraint student_question_cards_question_id_fkey
    foreign key (question_id) references public.questions(id) on delete cascade;

alter table public.fsrs_review_logs
  drop constraint fsrs_review_logs_card_id_fkey,
  add constraint fsrs_review_logs_card_id_fkey
    foreign key (card_id) references public.student_question_cards(id) on delete cascade,
  drop constraint fsrs_review_logs_question_id_fkey,
  add constraint fsrs_review_logs_question_id_fkey
    foreign key (question_id) references public.questions(id) on delete cascade,
  drop constraint fsrs_review_logs_session_question_id_fkey,
  add constraint fsrs_review_logs_session_question_id_fkey
    foreign key (session_question_id) references public.assessment_session_questions(id) on delete cascade;

-- A college is the root aggregate for its profiles, courses and audit trail.

alter table public.audit_logs
  drop constraint audit_logs_college_id_fkey,
  add constraint audit_logs_college_id_fkey
    foreign key (college_id) references public.colleges(id) on delete cascade;

alter table public.courses
  drop constraint courses_college_id_fkey,
  add constraint courses_college_id_fkey
    foreign key (college_id) references public.colleges(id) on delete cascade;

alter table public.profiles
  drop constraint profiles_college_id_fkey,
  add constraint profiles_college_id_fkey
    foreign key (college_id) references public.colleges(id) on delete cascade;
