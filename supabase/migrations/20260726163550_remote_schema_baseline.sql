


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_user_role" AS ENUM (
    'admin',
    'teacher',
    'student'
);


ALTER TYPE "public"."app_user_role" OWNER TO "postgres";


CREATE TYPE "public"."course_status" AS ENUM (
    'active',
    'inactive',
    'archived'
);


ALTER TYPE "public"."course_status" OWNER TO "postgres";


CREATE TYPE "public"."enrollment_status" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."enrollment_status" OWNER TO "postgres";


CREATE TYPE "public"."fsrs_rating" AS ENUM (
    'Again',
    'Good'
);


ALTER TYPE "public"."fsrs_rating" OWNER TO "postgres";


CREATE TYPE "public"."import_status" AS ENUM (
    'validating',
    'completed',
    'failed'
);


ALTER TYPE "public"."import_status" OWNER TO "postgres";


CREATE TYPE "public"."question_selection_reason" AS ENUM (
    'due',
    'new'
);


ALTER TYPE "public"."question_selection_reason" OWNER TO "postgres";


CREATE TYPE "public"."question_status" AS ENUM (
    'draft',
    'active',
    'inactive',
    'archived'
);


ALTER TYPE "public"."question_status" OWNER TO "postgres";


CREATE TYPE "public"."session_status" AS ENUM (
    'in_progress',
    'completed',
    'abandoned'
);


ALTER TYPE "public"."session_status" OWNER TO "postgres";


CREATE TYPE "public"."topic_status" AS ENUM (
    'draft',
    'active',
    'inactive',
    'archived'
);


ALTER TYPE "public"."topic_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_access_college"("target_college_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    private.is_admin() or (
      private.is_active_user()
      and
      private.current_college_id() = target_college_id
    )
    from public.profiles p
$$;


ALTER FUNCTION "private"."can_access_college"("target_college_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."current_college_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p.college_id
  from public.profiles p
  where p.id = (select auth.uid())
  limit 1;
$$;


ALTER FUNCTION "private"."current_college_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."current_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p.role::text
  from public.profiles p
  where p.id = (select auth.uid());
$$;


ALTER FUNCTION "private"."current_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."has_valid_student_access"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    (
      select (
        private.is_student() 
        and p.access_valid_from is not null 
        and p.access_valid_from is not null
        and (now() at time zone 'America/Lima')::date between p.access_valid_from and p.access_valid_until
      )
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  )
$$;


ALTER FUNCTION "private"."has_valid_student_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_active_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    (
      select p.is_active
      from public.profiles p
      where p.id = (select auth.uid())
    ), false
  )
$$;


ALTER FUNCTION "private"."is_active_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    (
      select
        p.role = 'admin'::public.app_user_role
        and p.is_active
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;


ALTER FUNCTION "private"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_student"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$select coalesce(
    (
      select p.role = 'student'::public.app_user_role and p.is_active
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  )$$;


ALTER FUNCTION "private"."is_student"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_teacher"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    (
      select p.role = 'teacher'::public.app_user_role
      from public.profiles p
      where p.id = (select auth.uid())
    )
    , false
  )
$$;


ALTER FUNCTION "private"."is_teacher"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."student_can_access_topic"("target_topic_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    exists (
      select 1
      from public.topics t
      join public.courses c
        on c.id = t.course_id
      join public.course_enrollments ce
        on ce.course_id = c.id
       and ce.student_id = (select auth.uid())
       and ce.status = 'active'::public.enrollment_status
      where t.id = target_topic_id
        and t.status = 'active'::public.topic_status
        and c.status = 'active'::public.course_status
        and private.has_valid_student_access()
        and not exists (
          select 1
          from public.student_topic_access sta
          where sta.topic_id = t.id
            and sta.student_id = (select auth.uid())
            and sta.is_blocked = true
        )
    ),
    false
  );
$$;


ALTER FUNCTION "private"."student_can_access_topic"("target_topic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."student_is_enrolled"("target_course_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    exists(
      select 1 from public.course_enrollments ce
      where ce.course_id = target_course_id
      and ce.student_id = (select auth.uid())
      and ce.status = 'active'::public.enrollment_status and private.is_student()
    ),
    false
  )
$$;


ALTER FUNCTION "private"."student_is_enrolled"("target_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."student_owns_session"("target_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    exists (
      select 1
      from public.assessment_sessions s
      where s.id = target_session_id
        and s.student_id = (select auth.uid())
        and private.is_student()
    ),
    false
  );
$$;


ALTER FUNCTION "private"."student_owns_session"("target_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."teacher_can_manage_enrollment"("target_course_id" "uuid", "target_student_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    exists(
      select 1 
      from public.courses c
      join public.profiles student on student.id = target_student_id
      where c.id = target_course_id and c.teacher_id = (select auth.uid())
      and student.role = 'student'::public.app_user_role and student.is_active and student.college_id = c.college_id
      and private.is_teacher()
    ), false
  )
$$;


ALTER FUNCTION "private"."teacher_can_manage_enrollment"("target_course_id" "uuid", "target_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."teacher_can_manage_topic_access"("target_topic_id" "uuid", "target_student_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    exists(
      select 1 
      from public.topics t
      join public.courses c on t.course_id = c.id
      join public.course_enrollments ce on ce.course_id = c.id
      and ce.student_id = target_student_id
      and ce.status = 'active'::public.enrollment_status
      where t.id = target_topic_id and c.teacher_id = (select auth.uid())
      and private.is_teacher()
    ), false
  )
$$;


ALTER FUNCTION "private"."teacher_can_manage_topic_access"("target_topic_id" "uuid", "target_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."teacher_can_view_session"("target_session_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    exists (
      select 1
      from public.assessment_sessions s
      join public.courses c
        on c.id = s.course_id
      where s.id = target_session_id
        and c.teacher_id = (select auth.uid())
        and private.is_teacher()
    ),
    false
  );
$$;


ALTER FUNCTION "private"."teacher_can_view_session"("target_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."teacher_can_view_student"("target_student_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    exists (
      select 1
      from public.course_enrollments ce
      join public.courses c
        on c.id = ce.course_id
      where ce.student_id = target_student_id
        and ce.status = 'active'::public.enrollment_status
        and c.teacher_id = (select auth.uid())
        and private.is_teacher()
    ),
    false
  );
$$;


ALTER FUNCTION "private"."teacher_can_view_student"("target_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."teacher_owns_course"("target_course_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    (
      exists (
        select 1
        from public.courses c
        where c.id = target_course_id and
        c.teacher_id = (select auth.uid()) and
        c.status <> 'archived'::public.course_status and
        private.is_teacher()
      )
    )
    ,false
  )
$$;


ALTER FUNCTION "private"."teacher_owns_course"("target_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."teacher_owns_topic"("target_topic_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    (
      exists(
        select 1 
        from public.topics t
        join public.courses c
          on c.id = t.course_id
          where t.id = target_topic_id
          and c.teacher_id = (select auth.uid())
          and private.is_teacher()
      )
    ),
    false
  )
$$;


ALTER FUNCTION "private"."teacher_owns_topic"("target_topic_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_assessment_session"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  topic_course uuid;
  student_role public.app_user_role;
begin
  select course_id into topic_course
  from public.topics
  where id = new.topic_id;

  if topic_course is distinct from new.course_id then
    raise exception 'topic_id does not belong to course_id';
  end if;

  select role into student_role
  from public.profiles
  where id = new.student_id;

  if student_role is distinct from 'student' then
    raise exception 'student_id must reference a student profile';
  end if;

  if not exists (
    select 1
    from public.course_enrollments ce
    where ce.course_id = new.course_id
      and ce.student_id = new.student_id
      and ce.status = 'active'
  ) then
    raise exception 'The student must be actively enrolled in the course';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_assessment_session"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_course_enrollment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  course_college uuid;
  student_role public.app_user_role;
  student_college uuid;
begin
  select college_id into course_college
  from public.courses
  where id = new.course_id;

  select role, college_id into student_role, student_college
  from public.profiles
  where id = new.student_id;

  if student_role is distinct from 'student' then
    raise exception 'student_id must reference a student profile';
  end if;

  if student_college is distinct from course_college then
    raise exception 'student and course must belong to the same college';
  end if;

  if new.status = 'inactive' and new.ended_at is null then
    new.ended_at = now();
  elsif new.status = 'active' then
    new.ended_at = null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_course_enrollment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_course_teacher_and_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  teacher_role public.app_user_role;
  teacher_college uuid;
  current_count integer;
begin
  select role, college_id into teacher_role, teacher_college
  from public.profiles
  where id = new.teacher_id;

  if teacher_role is distinct from 'teacher' then
    raise exception 'teacher_id must reference a teacher profile';
  end if;

  if teacher_college is distinct from new.college_id then
    raise exception 'teacher and course must belong to the same college';
  end if;

  if new.status <> 'archived' then
    select count(*) into current_count
    from public.courses
    where teacher_id = new.teacher_id
      and status <> 'archived'
      and id <> new.id;

    if current_count >= 8 then
      raise exception 'A teacher can have at most 8 non-archived courses';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_course_teacher_and_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_question_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  current_count integer;
begin
  if new.status <> 'archived' then
    select count(*) into current_count
    from public.questions
    where topic_id = new.topic_id
      and status <> 'archived'
      and id <> new.id;

    if current_count >= 50 then
      raise exception 'A topic can have at most 50 non-archived questions';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_question_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_session_question"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  session_topic uuid;
  question_topic uuid;
begin
  select topic_id into session_topic
  from public.assessment_sessions
  where id = new.session_id;

  select topic_id into question_topic
  from public.questions
  where id = new.question_id;

  if session_topic is distinct from question_topic then
    raise exception 'The question must belong to the session topic';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_session_question"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_student_topic_access"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  topic_course uuid;
begin
  select course_id into topic_course
  from public.topics
  where id = new.topic_id;

  if not exists (
    select 1
    from public.course_enrollments ce
    where ce.course_id = topic_course
      and ce.student_id = new.student_id
      and ce.status = 'active'
  ) then
    raise exception 'The student must be actively enrolled in the topic course';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_student_topic_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_topic_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  current_count integer;
begin
  if new.status <> 'archived' then
    select count(*) into current_count
    from public.topics
    where course_id = new.course_id
      and status <> 'archived'
      and id <> new.id;

    if current_count >= 8 then
      raise exception 'A course can have at most 8 non-archived topics';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_topic_limit"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."assessment_session_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "selection_reason" "public"."question_selection_reason" NOT NULL,
    "due_at_snapshot" timestamp with time zone,
    "selected_option" character(1),
    "is_correct" boolean,
    "fsrs_rating" "public"."fsrs_rating",
    "answered_at" timestamp with time zone,
    "response_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assessment_session_questions_answer_consistency" CHECK (((("selected_option" IS NULL) AND ("is_correct" IS NULL) AND ("fsrs_rating" IS NULL) AND ("answered_at" IS NULL)) OR (("selected_option" IS NOT NULL) AND ("is_correct" IS NOT NULL) AND ("fsrs_rating" IS NOT NULL) AND ("answered_at" IS NOT NULL)))),
    CONSTRAINT "assessment_session_questions_position_positive" CHECK (("position" > 0)),
    CONSTRAINT "assessment_session_questions_response_time_nonnegative" CHECK ((("response_time_ms" IS NULL) OR ("response_time_ms" >= 0))),
    CONSTRAINT "assessment_session_questions_selected_option_valid" CHECK ((("selected_option" IS NULL) OR ("selected_option" = ANY (ARRAY['A'::"bpchar", 'B'::"bpchar", 'C'::"bpchar", 'D'::"bpchar"]))))
);


ALTER TABLE "public"."assessment_session_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."assessment_session_questions" IS 'Questions selected for a session and the student response/result.';



CREATE TABLE IF NOT EXISTS "public"."assessment_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "fsrs_config_id" "uuid" NOT NULL,
    "status" "public"."session_status" DEFAULT 'in_progress'::"public"."session_status" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "abandoned_at" timestamp with time zone,
    "total_questions" integer NOT NULL,
    "answered_questions" integer DEFAULT 0 NOT NULL,
    "correct_count" integer DEFAULT 0 NOT NULL,
    "incorrect_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assessment_sessions_counts_consistent" CHECK (((("correct_count" + "incorrect_count") = "answered_questions") AND ("answered_questions" <= "total_questions"))),
    CONSTRAINT "assessment_sessions_counts_nonnegative" CHECK ((("answered_questions" >= 0) AND ("correct_count" >= 0) AND ("incorrect_count" >= 0))),
    CONSTRAINT "assessment_sessions_status_dates" CHECK (((("status" = 'in_progress'::"public"."session_status") AND ("completed_at" IS NULL) AND ("abandoned_at" IS NULL)) OR (("status" = 'completed'::"public"."session_status") AND ("completed_at" IS NOT NULL) AND ("abandoned_at" IS NULL)) OR (("status" = 'abandoned'::"public"."session_status") AND ("abandoned_at" IS NOT NULL) AND ("completed_at" IS NULL)))),
    CONSTRAINT "assessment_sessions_total_range" CHECK ((("total_questions" >= 1) AND ("total_questions" <= 20)))
);


ALTER TABLE "public"."assessment_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."assessment_sessions" IS 'Student assessment session for one topic, containing between 1 and 20 questions.';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "college_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audit_logs_action_not_blank" CHECK (("btrim"("action") <> ''::"text")),
    CONSTRAINT "audit_logs_entity_type_not_blank" CHECK (("btrim"("entity_type") <> ''::"text"))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_logs" IS 'Administrative and teacher action audit trail.';



CREATE TABLE IF NOT EXISTS "public"."colleges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "colleges_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "colleges_name_not_blank" CHECK (("btrim"("name") <> ''::"text"))
);


ALTER TABLE "public"."colleges" OWNER TO "postgres";


COMMENT ON TABLE "public"."colleges" IS 'Institutions participating in the learning platform.';



CREATE TABLE IF NOT EXISTS "public"."course_enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "status" "public"."enrollment_status" DEFAULT 'active'::"public"."enrollment_status" NOT NULL,
    "enrolled_by" "uuid",
    "enrolled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "course_enrollments_ended_consistency" CHECK (((("status" = 'active'::"public"."enrollment_status") AND ("ended_at" IS NULL)) OR ("status" = 'inactive'::"public"."enrollment_status")))
);


ALTER TABLE "public"."course_enrollments" OWNER TO "postgres";


COMMENT ON TABLE "public"."course_enrollments" IS 'Assignment of students to courses. Administrators and course teachers may manage these records through RLS.';



CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "college_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "public"."course_status" DEFAULT 'active'::"public"."course_status" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "courses_name_not_blank" CHECK (("btrim"("name") <> ''::"text"))
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


COMMENT ON TABLE "public"."courses" IS 'Courses owned by one teacher. Maximum 8 non-archived courses per teacher.';



CREATE TABLE IF NOT EXISTS "public"."fsrs_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "library_name" "text" DEFAULT 'ts-fsrs'::"text" NOT NULL,
    "library_version" "text" NOT NULL,
    "parameters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rating_mapping" "jsonb" DEFAULT '{"correct": "Good", "incorrect": "Again"}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "locked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fsrs_configs_library_version_not_blank" CHECK (("btrim"("library_version") <> ''::"text")),
    CONSTRAINT "fsrs_configs_name_not_blank" CHECK (("btrim"("name") <> ''::"text"))
);


ALTER TABLE "public"."fsrs_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."fsrs_configs" IS 'Versioned fixed FSRS configuration used by assessment sessions and cards.';



CREATE TABLE IF NOT EXISTS "public"."fsrs_review_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "card_id" "uuid" NOT NULL,
    "session_question_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "fsrs_config_id" "uuid" NOT NULL,
    "rating" "public"."fsrs_rating" NOT NULL,
    "reviewed_at" timestamp with time zone NOT NULL,
    "due_before" timestamp with time zone,
    "due_after" timestamp with time zone NOT NULL,
    "stability_before" numeric,
    "stability_after" numeric,
    "difficulty_before" numeric,
    "difficulty_after" numeric,
    "state_before" smallint,
    "state_after" smallint NOT NULL,
    "scheduled_days_before" integer,
    "scheduled_days_after" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fsrs_review_logs_scheduled_days_nonnegative" CHECK (((("scheduled_days_before" IS NULL) OR ("scheduled_days_before" >= 0)) AND (("scheduled_days_after" IS NULL) OR ("scheduled_days_after" >= 0)))),
    CONSTRAINT "fsrs_review_logs_state_after_valid" CHECK ((("state_after" >= 0) AND ("state_after" <= 3))),
    CONSTRAINT "fsrs_review_logs_state_before_valid" CHECK ((("state_before" IS NULL) OR (("state_before" >= 0) AND ("state_before" <= 3))))
);


ALTER TABLE "public"."fsrs_review_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."fsrs_review_logs" IS 'Immutable history of FSRS scheduling transitions.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "college_id" "uuid",
    "role" "public"."app_user_role" NOT NULL,
    "user_code" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "access_valid_from" "date",
    "access_valid_until" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_access_dates_order" CHECK ((("access_valid_from" IS NULL) OR ("access_valid_until" IS NULL) OR ("access_valid_from" <= "access_valid_until"))),
    CONSTRAINT "profiles_college_required" CHECK ((("role" = 'admin'::"public"."app_user_role") OR ("college_id" IS NOT NULL))),
    CONSTRAINT "profiles_full_name_not_blank" CHECK (("btrim"("full_name") <> ''::"text")),
    CONSTRAINT "profiles_student_dates_required" CHECK ((("role" <> 'student'::"public"."app_user_role") OR (("access_valid_from" IS NOT NULL) AND ("access_valid_until" IS NOT NULL)))),
    CONSTRAINT "profiles_user_code_not_blank" CHECK (("btrim"("user_code") <> ''::"text"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Application profiles linked one-to-one with auth.users. Students are created manually by an administrator with a unique access code.';



CREATE TABLE IF NOT EXISTS "public"."question_import_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "total_rows" integer DEFAULT 0 NOT NULL,
    "accepted_rows" integer DEFAULT 0 NOT NULL,
    "rejected_rows" integer DEFAULT 0 NOT NULL,
    "status" "public"."import_status" DEFAULT 'validating'::"public"."import_status" NOT NULL,
    "validation_report" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "question_import_counts_nonnegative" CHECK ((("total_rows" >= 0) AND ("accepted_rows" >= 0) AND ("rejected_rows" >= 0))),
    CONSTRAINT "question_import_counts_within_total" CHECK ((("accepted_rows" + "rejected_rows") <= "total_rows")),
    CONSTRAINT "question_import_filename_not_blank" CHECK (("btrim"("filename") <> ''::"text"))
);


ALTER TABLE "public"."question_import_batches" OWNER TO "postgres";


COMMENT ON TABLE "public"."question_import_batches" IS 'Audit record for Excel question imports.';



CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "import_batch_id" "uuid",
    "statement" "text" NOT NULL,
    "option_a" "text" NOT NULL,
    "option_b" "text" NOT NULL,
    "option_c" "text" NOT NULL,
    "option_d" "text" NOT NULL,
    "correct_option" character(1) NOT NULL,
    "explanation" "text",
    "status" "public"."question_status" DEFAULT 'active'::"public"."question_status" NOT NULL,
    "supersedes_question_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "questions_correct_option_valid" CHECK (("correct_option" = ANY (ARRAY['A'::"bpchar", 'B'::"bpchar", 'C'::"bpchar", 'D'::"bpchar"]))),
    CONSTRAINT "questions_not_self_superseding" CHECK ((("supersedes_question_id" IS NULL) OR ("supersedes_question_id" <> "id"))),
    CONSTRAINT "questions_option_a_not_blank" CHECK (("btrim"("option_a") <> ''::"text")),
    CONSTRAINT "questions_option_b_not_blank" CHECK (("btrim"("option_b") <> ''::"text")),
    CONSTRAINT "questions_option_c_not_blank" CHECK (("btrim"("option_c") <> ''::"text")),
    CONSTRAINT "questions_option_d_not_blank" CHECK (("btrim"("option_d") <> ''::"text")),
    CONSTRAINT "questions_statement_not_blank" CHECK (("btrim"("statement") <> ''::"text"))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."questions" IS 'Four-option questions with LaTeX-compatible text and an optional teacher explanation. Maximum 50 non-archived questions per topic.';



CREATE TABLE IF NOT EXISTS "public"."student_question_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "fsrs_config_id" "uuid" NOT NULL,
    "due_at" timestamp with time zone NOT NULL,
    "stability" numeric,
    "difficulty" numeric,
    "elapsed_days" integer DEFAULT 0 NOT NULL,
    "scheduled_days" integer DEFAULT 0 NOT NULL,
    "learning_steps" integer DEFAULT 0 NOT NULL,
    "reps" integer DEFAULT 0 NOT NULL,
    "lapses" integer DEFAULT 0 NOT NULL,
    "state" smallint DEFAULT 0 NOT NULL,
    "last_review_at" timestamp with time zone,
    "fsrs_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "student_question_cards_counts_nonnegative" CHECK ((("elapsed_days" >= 0) AND ("scheduled_days" >= 0) AND ("learning_steps" >= 0) AND ("reps" >= 0) AND ("lapses" >= 0))),
    CONSTRAINT "student_question_cards_state_valid" CHECK ((("state" >= 0) AND ("state" <= 3)))
);


ALTER TABLE "public"."student_question_cards" OWNER TO "postgres";


COMMENT ON TABLE "public"."student_question_cards" IS 'Current FSRS state for a student-question pair.';



CREATE TABLE IF NOT EXISTS "public"."student_topic_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "is_blocked" boolean DEFAULT false NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."student_topic_access" OWNER TO "postgres";


COMMENT ON TABLE "public"."student_topic_access" IS 'Indefinite per-student topic blocking flag. No scheduling dates are stored.';



CREATE TABLE IF NOT EXISTS "public"."topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "material_url" "text",
    "position" integer DEFAULT 1 NOT NULL,
    "status" "public"."topic_status" DEFAULT 'draft'::"public"."topic_status" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "topics_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "topics_position_positive" CHECK (("position" > 0))
);


ALTER TABLE "public"."topics" OWNER TO "postgres";


COMMENT ON TABLE "public"."topics" IS 'Topics within a course. Maximum 8 non-archived topics per course.';



CREATE OR REPLACE VIEW "public"."v_completed_session_review" WITH ("security_invoker"='true') AS
 SELECT "s"."id" AS "session_id",
    "s"."student_id",
    "s"."course_id",
    "s"."topic_id",
    "s"."completed_at",
    "sq"."id" AS "session_question_id",
    "sq"."position",
    "q"."id" AS "question_id",
    "q"."statement",
    "q"."option_a",
    "q"."option_b",
    "q"."option_c",
    "q"."option_d",
    "sq"."selected_option",
    "q"."correct_option",
    "sq"."is_correct",
    "q"."explanation",
    "sq"."response_time_ms",
    "sq"."selection_reason",
    "sq"."fsrs_rating",
    "sq"."answered_at"
   FROM (("public"."assessment_sessions" "s"
     JOIN "public"."assessment_session_questions" "sq" ON (("sq"."session_id" = "s"."id")))
     JOIN "public"."questions" "q" ON (("q"."id" = "sq"."question_id")))
  WHERE ("s"."status" = 'completed'::"public"."session_status");


ALTER VIEW "public"."v_completed_session_review" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_completed_session_review" IS 'Question-by-question review available only for completed sessions.';



CREATE OR REPLACE VIEW "public"."v_export_all_data" WITH ("security_invoker"='true') AS
 SELECT "col"."id" AS "college_id",
    "col"."code" AS "college_code",
    "col"."name" AS "college_name",
    "teacher"."id" AS "teacher_id",
    "teacher"."user_code" AS "teacher_code",
    "teacher"."full_name" AS "teacher_name",
    "student"."id" AS "student_id",
    "student"."user_code" AS "student_code",
    "student"."full_name" AS "student_name",
    "student"."access_valid_from",
    "student"."access_valid_until",
    "c"."id" AS "course_id",
    "c"."name" AS "course_name",
    "t"."id" AS "topic_id",
    "t"."name" AS "topic_name",
    "s"."id" AS "session_id",
    "s"."status" AS "session_status",
    "s"."started_at",
    "s"."completed_at",
    "s"."abandoned_at",
    "s"."total_questions",
    "s"."answered_questions",
    "s"."correct_count" AS "session_correct_count",
    "s"."incorrect_count" AS "session_incorrect_count",
        CASE
            WHEN ("s"."answered_questions" > 0) THEN "round"(((("s"."correct_count")::numeric / ("s"."answered_questions")::numeric) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "session_correct_percentage",
        CASE
            WHEN ("s"."answered_questions" > 0) THEN "round"(((("s"."incorrect_count")::numeric / ("s"."answered_questions")::numeric) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "session_error_percentage",
    "sq"."id" AS "session_question_id",
    "sq"."position",
    "sq"."selection_reason",
    "sq"."due_at_snapshot",
    "q"."id" AS "question_id",
    "q"."statement",
    "q"."option_a",
    "q"."option_b",
    "q"."option_c",
    "q"."option_d",
    "sq"."selected_option",
    "q"."correct_option",
    "sq"."is_correct",
    "q"."explanation",
    "sq"."answered_at",
    "sq"."response_time_ms",
    "sq"."fsrs_rating",
    "card"."id" AS "card_id",
    "card"."due_at" AS "current_due_at",
    "card"."stability" AS "current_stability",
    "card"."difficulty" AS "current_difficulty",
    "card"."elapsed_days" AS "current_elapsed_days",
    "card"."scheduled_days" AS "current_scheduled_days",
    "card"."learning_steps" AS "current_learning_steps",
    "card"."reps" AS "current_reps",
    "card"."lapses" AS "current_lapses",
    "card"."state" AS "current_state",
    "card"."last_review_at",
    "log"."reviewed_at" AS "fsrs_reviewed_at",
    "log"."due_before",
    "log"."due_after",
    "log"."stability_before",
    "log"."stability_after",
    "log"."difficulty_before",
    "log"."difficulty_after",
    "log"."state_before",
    "log"."state_after",
    "log"."scheduled_days_before",
    "log"."scheduled_days_after"
   FROM ((((((((("public"."assessment_sessions" "s"
     JOIN "public"."profiles" "student" ON (("student"."id" = "s"."student_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "s"."course_id")))
     JOIN "public"."profiles" "teacher" ON (("teacher"."id" = "c"."teacher_id")))
     JOIN "public"."colleges" "col" ON (("col"."id" = "c"."college_id")))
     JOIN "public"."topics" "t" ON (("t"."id" = "s"."topic_id")))
     JOIN "public"."assessment_session_questions" "sq" ON (("sq"."session_id" = "s"."id")))
     JOIN "public"."questions" "q" ON (("q"."id" = "sq"."question_id")))
     LEFT JOIN "public"."student_question_cards" "card" ON ((("card"."student_id" = "s"."student_id") AND ("card"."question_id" = "q"."id"))))
     LEFT JOIN "public"."fsrs_review_logs" "log" ON (("log"."session_question_id" = "sq"."id")));


ALTER VIEW "public"."v_export_all_data" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_export_all_data" IS 'Comprehensive row-level export for CSV download, including session, response, question, and FSRS fields.';



CREATE OR REPLACE VIEW "public"."v_session_results" WITH ("security_invoker"='true') AS
 SELECT "s"."id" AS "session_id",
    "s"."student_id",
    "p"."full_name" AS "student_name",
    "p"."user_code" AS "student_code",
    "s"."course_id",
    "c"."name" AS "course_name",
    "s"."topic_id",
    "t"."name" AS "topic_name",
    "s"."status",
    "s"."started_at",
    "s"."completed_at",
    "s"."total_questions",
    "s"."answered_questions",
    "s"."correct_count",
    "s"."incorrect_count",
        CASE
            WHEN ("s"."answered_questions" > 0) THEN "round"(((("s"."correct_count")::numeric / ("s"."answered_questions")::numeric) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "correct_percentage",
        CASE
            WHEN ("s"."answered_questions" > 0) THEN "round"(((("s"."incorrect_count")::numeric / ("s"."answered_questions")::numeric) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "error_percentage"
   FROM ((("public"."assessment_sessions" "s"
     JOIN "public"."profiles" "p" ON (("p"."id" = "s"."student_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "s"."course_id")))
     JOIN "public"."topics" "t" ON (("t"."id" = "s"."topic_id")));


ALTER VIEW "public"."v_session_results" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_session_results" IS 'Per-session dashboard with correct and error percentages.';



CREATE OR REPLACE VIEW "public"."v_student_topic_progress" WITH ("security_invoker"='true') AS
 SELECT "s"."student_id",
    "p"."full_name" AS "student_name",
    "p"."user_code" AS "student_code",
    "s"."course_id",
    "c"."name" AS "course_name",
    "s"."topic_id",
    "t"."name" AS "topic_name",
    "count"(DISTINCT "s"."id") AS "completed_sessions",
    "count"("sq"."id") FILTER (WHERE ("sq"."answered_at" IS NOT NULL)) AS "answered_questions",
    "count"("sq"."id") FILTER (WHERE ("sq"."is_correct" IS TRUE)) AS "correct_count",
    "count"("sq"."id") FILTER (WHERE ("sq"."is_correct" IS FALSE)) AS "incorrect_count",
        CASE
            WHEN ("count"("sq"."id") FILTER (WHERE ("sq"."answered_at" IS NOT NULL)) > 0) THEN "round"(((("count"("sq"."id") FILTER (WHERE ("sq"."is_correct" IS TRUE)))::numeric / ("count"("sq"."id") FILTER (WHERE ("sq"."answered_at" IS NOT NULL)))::numeric) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "correct_percentage",
        CASE
            WHEN ("count"("sq"."id") FILTER (WHERE ("sq"."answered_at" IS NOT NULL)) > 0) THEN "round"(((("count"("sq"."id") FILTER (WHERE ("sq"."is_correct" IS FALSE)))::numeric / ("count"("sq"."id") FILTER (WHERE ("sq"."answered_at" IS NOT NULL)))::numeric) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "error_percentage",
    "max"("s"."completed_at") AS "last_completed_at"
   FROM (((("public"."assessment_sessions" "s"
     JOIN "public"."profiles" "p" ON (("p"."id" = "s"."student_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "s"."course_id")))
     JOIN "public"."topics" "t" ON (("t"."id" = "s"."topic_id")))
     JOIN "public"."assessment_session_questions" "sq" ON (("sq"."session_id" = "s"."id")))
  WHERE ("s"."status" = 'completed'::"public"."session_status")
  GROUP BY "s"."student_id", "p"."full_name", "p"."user_code", "s"."course_id", "c"."name", "s"."topic_id", "t"."name";


ALTER VIEW "public"."v_student_topic_progress" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_student_topic_progress" IS 'Accumulated student performance by topic using completed sessions only.';



CREATE OR REPLACE VIEW "public"."v_student_course_progress" WITH ("security_invoker"='true') AS
 SELECT "student_id",
    "student_name",
    "student_code",
    "course_id",
    "course_name",
    "count"(*) AS "topics_with_data",
    "sum"("completed_sessions") AS "completed_sessions",
    "sum"("answered_questions") AS "answered_questions",
    "sum"("correct_count") AS "correct_count",
    "sum"("incorrect_count") AS "incorrect_count",
    "round"("avg"("correct_percentage"), 2) AS "course_correct_percentage",
    "round"("avg"("error_percentage"), 2) AS "course_error_percentage",
    "max"("last_completed_at") AS "last_completed_at"
   FROM "public"."v_student_topic_progress" "tp"
  GROUP BY "student_id", "student_name", "student_code", "course_id", "course_name";


ALTER VIEW "public"."v_student_course_progress" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_student_course_progress" IS 'Simple average of topic percentages for topics that have completed-session data.';



CREATE OR REPLACE VIEW "public"."v_student_topic_access_status" WITH ("security_invoker"='true') AS
 SELECT "ce"."student_id",
    "student"."full_name" AS "student_name",
    "student"."user_code" AS "student_code",
    "c"."id" AS "course_id",
    "c"."name" AS "course_name",
    "t"."id" AS "topic_id",
    "t"."name" AS "topic_name",
    "t"."status" AS "topic_status",
    COALESCE("sta"."is_blocked", false) AS "is_blocked",
    "sta"."updated_by",
    "sta"."updated_at"
   FROM (((("public"."course_enrollments" "ce"
     JOIN "public"."profiles" "student" ON (("student"."id" = "ce"."student_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "ce"."course_id")))
     JOIN "public"."topics" "t" ON (("t"."course_id" = "c"."id")))
     LEFT JOIN "public"."student_topic_access" "sta" ON ((("sta"."student_id" = "ce"."student_id") AND ("sta"."topic_id" = "t"."id"))))
  WHERE ("ce"."status" = 'active'::"public"."enrollment_status");


ALTER VIEW "public"."v_student_topic_access_status" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_student_topic_access_status" IS 'Effective per-student topic block status for active course enrollments.';



CREATE OR REPLACE VIEW "public"."v_teacher_students" WITH ("security_invoker"='true') AS
 SELECT "c"."teacher_id",
    "teacher"."full_name" AS "teacher_name",
    "teacher"."user_code" AS "teacher_code",
    "c"."college_id",
    "col"."name" AS "college_name",
    "c"."id" AS "course_id",
    "c"."name" AS "course_name",
    "ce"."student_id",
    "student"."full_name" AS "student_name",
    "student"."user_code" AS "student_code",
    "student"."is_active" AS "student_is_active",
    "student"."access_valid_from",
    "student"."access_valid_until",
    "ce"."status" AS "enrollment_status",
    "ce"."enrolled_at",
    "ce"."ended_at",
    "max"("s"."completed_at") FILTER (WHERE ("s"."status" = 'completed'::"public"."session_status")) AS "last_completed_session_at"
   FROM ((((("public"."courses" "c"
     JOIN "public"."profiles" "teacher" ON (("teacher"."id" = "c"."teacher_id")))
     JOIN "public"."colleges" "col" ON (("col"."id" = "c"."college_id")))
     JOIN "public"."course_enrollments" "ce" ON (("ce"."course_id" = "c"."id")))
     JOIN "public"."profiles" "student" ON (("student"."id" = "ce"."student_id")))
     LEFT JOIN "public"."assessment_sessions" "s" ON ((("s"."course_id" = "c"."id") AND ("s"."student_id" = "ce"."student_id"))))
  GROUP BY "c"."teacher_id", "teacher"."full_name", "teacher"."user_code", "c"."college_id", "col"."name", "c"."id", "c"."name", "ce"."student_id", "student"."full_name", "student"."user_code", "student"."is_active", "student"."access_valid_from", "student"."access_valid_until", "ce"."status", "ce"."enrolled_at", "ce"."ended_at";


ALTER VIEW "public"."v_teacher_students" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_teacher_students" IS 'Teacher-course-student assignments and latest completed session.';



ALTER TABLE ONLY "public"."assessment_session_questions"
    ADD CONSTRAINT "assessment_session_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assessment_session_questions"
    ADD CONSTRAINT "assessment_session_questions_unique_position" UNIQUE ("session_id", "position");



ALTER TABLE ONLY "public"."assessment_session_questions"
    ADD CONSTRAINT "assessment_session_questions_unique_question" UNIQUE ("session_id", "question_id");



ALTER TABLE ONLY "public"."assessment_sessions"
    ADD CONSTRAINT "assessment_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."colleges"
    ADD CONSTRAINT "colleges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_unique" UNIQUE ("course_id", "student_id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fsrs_configs"
    ADD CONSTRAINT "fsrs_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fsrs_review_logs"
    ADD CONSTRAINT "fsrs_review_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fsrs_review_logs"
    ADD CONSTRAINT "fsrs_review_logs_session_question_unique" UNIQUE ("session_question_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."question_import_batches"
    ADD CONSTRAINT "question_import_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_question_cards"
    ADD CONSTRAINT "student_question_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_question_cards"
    ADD CONSTRAINT "student_question_cards_unique" UNIQUE ("student_id", "question_id");



ALTER TABLE ONLY "public"."student_topic_access"
    ADD CONSTRAINT "student_topic_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_topic_access"
    ADD CONSTRAINT "student_topic_access_unique" UNIQUE ("student_id", "topic_id");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_pkey" PRIMARY KEY ("id");



CREATE INDEX "assessment_session_questions_question_idx" ON "public"."assessment_session_questions" USING "btree" ("question_id");



CREATE INDEX "assessment_session_questions_session_position_idx" ON "public"."assessment_session_questions" USING "btree" ("session_id", "position");



CREATE INDEX "assessment_sessions_course_status_idx" ON "public"."assessment_sessions" USING "btree" ("course_id", "status");



CREATE INDEX "assessment_sessions_student_topic_started_idx" ON "public"."assessment_sessions" USING "btree" ("student_id", "topic_id", "started_at" DESC);



CREATE INDEX "assessment_sessions_topic_status_idx" ON "public"."assessment_sessions" USING "btree" ("topic_id", "status");



CREATE INDEX "audit_logs_actor_created_idx" ON "public"."audit_logs" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "audit_logs_college_created_idx" ON "public"."audit_logs" USING "btree" ("college_id", "created_at" DESC);



CREATE INDEX "audit_logs_entity_idx" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE UNIQUE INDEX "colleges_code_unique_ci" ON "public"."colleges" USING "btree" ("lower"("btrim"("code")));



CREATE INDEX "course_enrollments_course_status_idx" ON "public"."course_enrollments" USING "btree" ("course_id", "status");



CREATE INDEX "course_enrollments_student_status_idx" ON "public"."course_enrollments" USING "btree" ("student_id", "status");



CREATE INDEX "courses_college_idx" ON "public"."courses" USING "btree" ("college_id");



CREATE UNIQUE INDEX "courses_teacher_name_unique_active_ci" ON "public"."courses" USING "btree" ("teacher_id", "lower"("btrim"("name"))) WHERE ("status" <> 'archived'::"public"."course_status");



CREATE INDEX "courses_teacher_status_idx" ON "public"."courses" USING "btree" ("teacher_id", "status");



CREATE UNIQUE INDEX "fsrs_configs_single_active_idx" ON "public"."fsrs_configs" USING "btree" ("is_active") WHERE "is_active";



CREATE INDEX "fsrs_review_logs_card_reviewed_idx" ON "public"."fsrs_review_logs" USING "btree" ("card_id", "reviewed_at" DESC);



CREATE INDEX "fsrs_review_logs_question_reviewed_idx" ON "public"."fsrs_review_logs" USING "btree" ("question_id", "reviewed_at" DESC);



CREATE INDEX "fsrs_review_logs_student_reviewed_idx" ON "public"."fsrs_review_logs" USING "btree" ("student_id", "reviewed_at" DESC);



CREATE INDEX "profiles_college_role_idx" ON "public"."profiles" USING "btree" ("college_id", "role");



CREATE UNIQUE INDEX "profiles_user_code_unique_ci" ON "public"."profiles" USING "btree" ("lower"("btrim"("user_code")));



CREATE INDEX "question_import_batches_topic_created_idx" ON "public"."question_import_batches" USING "btree" ("topic_id", "created_at" DESC);



CREATE INDEX "questions_import_batch_idx" ON "public"."questions" USING "btree" ("import_batch_id");



CREATE INDEX "questions_supersedes_idx" ON "public"."questions" USING "btree" ("supersedes_question_id");



CREATE INDEX "questions_topic_status_idx" ON "public"."questions" USING "btree" ("topic_id", "status");



CREATE INDEX "student_question_cards_due_lookup_idx" ON "public"."student_question_cards" USING "btree" ("student_id", "due_at");



CREATE INDEX "student_question_cards_question_idx" ON "public"."student_question_cards" USING "btree" ("question_id");



CREATE INDEX "student_topic_access_lookup_idx" ON "public"."student_topic_access" USING "btree" ("student_id", "topic_id", "is_blocked");



CREATE UNIQUE INDEX "topics_course_name_unique_active_ci" ON "public"."topics" USING "btree" ("course_id", "lower"("btrim"("name"))) WHERE ("status" <> 'archived'::"public"."topic_status");



CREATE UNIQUE INDEX "topics_course_position_unique_active" ON "public"."topics" USING "btree" ("course_id", "position") WHERE ("status" <> 'archived'::"public"."topic_status");



CREATE INDEX "topics_course_status_position_idx" ON "public"."topics" USING "btree" ("course_id", "status", "position");



CREATE OR REPLACE TRIGGER "assessment_session_questions_set_updated_at" BEFORE UPDATE ON "public"."assessment_session_questions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "assessment_session_questions_validate" BEFORE INSERT OR UPDATE OF "session_id", "question_id" ON "public"."assessment_session_questions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_session_question"();



CREATE OR REPLACE TRIGGER "assessment_sessions_set_updated_at" BEFORE UPDATE ON "public"."assessment_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "assessment_sessions_validate" BEFORE INSERT OR UPDATE OF "student_id", "course_id", "topic_id" ON "public"."assessment_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_assessment_session"();



CREATE OR REPLACE TRIGGER "colleges_set_updated_at" BEFORE UPDATE ON "public"."colleges" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "course_enrollments_set_updated_at" BEFORE UPDATE ON "public"."course_enrollments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "course_enrollments_validate" BEFORE INSERT OR UPDATE OF "course_id", "student_id", "status" ON "public"."course_enrollments" FOR EACH ROW EXECUTE FUNCTION "public"."validate_course_enrollment"();



CREATE OR REPLACE TRIGGER "courses_set_updated_at" BEFORE UPDATE ON "public"."courses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "courses_validate_teacher_and_limit" BEFORE INSERT OR UPDATE OF "teacher_id", "college_id", "status" ON "public"."courses" FOR EACH ROW EXECUTE FUNCTION "public"."validate_course_teacher_and_limit"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "questions_set_updated_at" BEFORE UPDATE ON "public"."questions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "questions_validate_limit" BEFORE INSERT OR UPDATE OF "topic_id", "status" ON "public"."questions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_question_limit"();



CREATE OR REPLACE TRIGGER "student_question_cards_set_updated_at" BEFORE UPDATE ON "public"."student_question_cards" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "student_topic_access_set_updated_at" BEFORE UPDATE ON "public"."student_topic_access" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "student_topic_access_validate" BEFORE INSERT OR UPDATE OF "student_id", "topic_id" ON "public"."student_topic_access" FOR EACH ROW EXECUTE FUNCTION "public"."validate_student_topic_access"();



CREATE OR REPLACE TRIGGER "topics_set_updated_at" BEFORE UPDATE ON "public"."topics" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "topics_validate_limit" BEFORE INSERT OR UPDATE OF "course_id", "status" ON "public"."topics" FOR EACH ROW EXECUTE FUNCTION "public"."validate_topic_limit"();



ALTER TABLE ONLY "public"."assessment_session_questions"
    ADD CONSTRAINT "assessment_session_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."assessment_session_questions"
    ADD CONSTRAINT "assessment_session_questions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assessment_sessions"
    ADD CONSTRAINT "assessment_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."assessment_sessions"
    ADD CONSTRAINT "assessment_sessions_fsrs_config_id_fkey" FOREIGN KEY ("fsrs_config_id") REFERENCES "public"."fsrs_configs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."assessment_sessions"
    ADD CONSTRAINT "assessment_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."assessment_sessions"
    ADD CONSTRAINT "assessment_sessions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_enrolled_by_fkey" FOREIGN KEY ("enrolled_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fsrs_review_logs"
    ADD CONSTRAINT "fsrs_review_logs_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."student_question_cards"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fsrs_review_logs"
    ADD CONSTRAINT "fsrs_review_logs_fsrs_config_id_fkey" FOREIGN KEY ("fsrs_config_id") REFERENCES "public"."fsrs_configs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fsrs_review_logs"
    ADD CONSTRAINT "fsrs_review_logs_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fsrs_review_logs"
    ADD CONSTRAINT "fsrs_review_logs_session_question_id_fkey" FOREIGN KEY ("session_question_id") REFERENCES "public"."assessment_session_questions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fsrs_review_logs"
    ADD CONSTRAINT "fsrs_review_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_import_batches"
    ADD CONSTRAINT "question_import_batches_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."question_import_batches"
    ADD CONSTRAINT "question_import_batches_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "public"."question_import_batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_supersedes_question_id_fkey" FOREIGN KEY ("supersedes_question_id") REFERENCES "public"."questions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_question_cards"
    ADD CONSTRAINT "student_question_cards_fsrs_config_id_fkey" FOREIGN KEY ("fsrs_config_id") REFERENCES "public"."fsrs_configs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_question_cards"
    ADD CONSTRAINT "student_question_cards_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_question_cards"
    ADD CONSTRAINT "student_question_cards_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_topic_access"
    ADD CONSTRAINT "student_topic_access_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_topic_access"
    ADD CONSTRAINT "student_topic_access_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_topic_access"
    ADD CONSTRAINT "student_topic_access_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE "public"."assessment_session_questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assessment_session_questions_select" ON "public"."assessment_session_questions" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR "private"."teacher_can_view_session"("session_id") OR ("private"."student_owns_session"("session_id") AND ( SELECT "private"."has_valid_student_access"() AS "has_valid_student_access"))));



ALTER TABLE "public"."assessment_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assessment_sessions_select" ON "public"."assessment_sessions" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR "private"."teacher_can_view_session"("id") OR (("student_id" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "private"."has_valid_student_access"() AS "has_valid_student_access"))));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_select" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin"));



ALTER TABLE "public"."colleges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "colleges_insert" ON "public"."colleges" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));



CREATE POLICY "colleges_select" ON "public"."colleges" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR (( SELECT "private"."is_active_user"() AS "is_active_user") AND ("id" = ( SELECT "private"."current_college_id"() AS "current_college_id")))));



CREATE POLICY "colleges_update" ON "public"."colleges" FOR UPDATE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));



ALTER TABLE "public"."course_enrollments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "course_enrollments_insert" ON "public"."course_enrollments" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."is_admin"() AS "is_admin") OR ("private"."teacher_can_manage_enrollment"("course_id", "student_id") AND ("enrolled_by" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "course_enrollments_select" ON "public"."course_enrollments" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR ("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."teacher_owns_course"("course_id")));



CREATE POLICY "course_enrollments_update" ON "public"."course_enrollments" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR "private"."teacher_owns_course"("course_id"))) WITH CHECK ((( SELECT "private"."is_admin"() AS "is_admin") OR "private"."teacher_can_manage_enrollment"("course_id", "student_id")));



ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "courses_insert" ON "public"."courses" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."is_admin"() AS "is_admin") OR (( SELECT "private"."is_teacher"() AS "is_teacher") AND ("teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("college_id" = ( SELECT "private"."current_college_id"() AS "current_college_id")) AND ("created_by" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "courses_select" ON "public"."courses" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR "private"."teacher_owns_course"("id") OR (( SELECT "private"."has_valid_student_access"() AS "has_valid_student_access") AND "private"."student_is_enrolled"("id"))));



CREATE POLICY "courses_update" ON "public"."courses" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR "private"."teacher_owns_course"("id"))) WITH CHECK ((( SELECT "private"."is_admin"() AS "is_admin") OR (( SELECT "private"."is_teacher"() AS "is_teacher") AND ("teacher_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("college_id" = ( SELECT "private"."current_college_id"() AS "current_college_id")))));



ALTER TABLE "public"."fsrs_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fsrs_configs_select" ON "public"."fsrs_configs" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_active_user"() AS "is_active_user"));



ALTER TABLE "public"."fsrs_review_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fsrs_review_logs_select" ON "public"."fsrs_review_logs" FOR SELECT TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR ("id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."teacher_can_view_student"("id")));



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (( SELECT "private"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "private"."is_admin"() AS "is_admin"));



ALTER TABLE "public"."question_import_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "question_import_batches_insert" ON "public"."question_import_batches" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."is_admin"() AS "is_admin") OR ("private"."teacher_owns_topic"("topic_id") AND ("uploaded_by" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "question_import_batches_select" ON "public"."question_import_batches" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR "private"."teacher_owns_topic"("topic_id")));



ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "questions_insert" ON "public"."questions" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."is_admin"() AS "is_admin") OR ("private"."teacher_owns_topic"("topic_id") AND ("created_by" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "questions_select" ON "public"."questions" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR "private"."teacher_owns_topic"("topic_id")));



ALTER TABLE "public"."student_question_cards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_question_cards_select" ON "public"."student_question_cards" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR ("student_id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."student_topic_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_topic_access_insert" ON "public"."student_topic_access" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."is_admin"() AS "is_admin") OR ("private"."teacher_can_manage_topic_access"("topic_id", "student_id") AND ("updated_by" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "student_topic_access_select" ON "public"."student_topic_access" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR ("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR "private"."teacher_can_manage_topic_access"("topic_id", "student_id")));



CREATE POLICY "student_topic_access_update" ON "public"."student_topic_access" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR "private"."teacher_can_manage_topic_access"("topic_id", "student_id"))) WITH CHECK ((( SELECT "private"."is_admin"() AS "is_admin") OR ("private"."teacher_can_manage_topic_access"("topic_id", "student_id") AND ("updated_by" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."topics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "topics_insert" ON "public"."topics" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."is_admin"() AS "is_admin") OR ("private"."teacher_owns_course"("course_id") AND ("created_by" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "topics_select" ON "public"."topics" FOR SELECT TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR "private"."teacher_owns_course"("course_id") OR (("status" = 'active'::"public"."topic_status") AND ( SELECT "private"."has_valid_student_access"() AS "has_valid_student_access") AND "private"."student_is_enrolled"("course_id"))));



CREATE POLICY "topics_update" ON "public"."topics" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."is_admin"() AS "is_admin") OR "private"."teacher_owns_course"("course_id"))) WITH CHECK ((( SELECT "private"."is_admin"() AS "is_admin") OR "private"."teacher_owns_course"("course_id")));



GRANT USAGE ON SCHEMA "private" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "private"."can_access_college"("target_college_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_access_college"("target_college_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."current_college_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."current_college_id"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."current_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."current_role"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."has_valid_student_access"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."has_valid_student_access"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."is_active_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_active_user"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."is_student"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_student"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."is_teacher"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_teacher"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."student_can_access_topic"("target_topic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."student_can_access_topic"("target_topic_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."student_is_enrolled"("target_course_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."student_is_enrolled"("target_course_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."student_owns_session"("target_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."student_owns_session"("target_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."teacher_can_manage_enrollment"("target_course_id" "uuid", "target_student_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."teacher_can_manage_enrollment"("target_course_id" "uuid", "target_student_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."teacher_can_manage_topic_access"("target_topic_id" "uuid", "target_student_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."teacher_can_manage_topic_access"("target_topic_id" "uuid", "target_student_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."teacher_can_view_session"("target_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."teacher_can_view_session"("target_session_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."teacher_can_view_student"("target_student_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."teacher_can_view_student"("target_student_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."teacher_owns_course"("target_course_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."teacher_owns_course"("target_course_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."teacher_owns_topic"("target_topic_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."teacher_owns_topic"("target_topic_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_assessment_session"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_assessment_session"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_assessment_session"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_course_enrollment"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_course_enrollment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_course_enrollment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_course_teacher_and_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_course_teacher_and_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_course_teacher_and_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_question_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_question_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_question_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_session_question"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_session_question"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_session_question"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_student_topic_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_student_topic_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_student_topic_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_topic_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_topic_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_topic_limit"() TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."assessment_session_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."assessment_session_questions" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."assessment_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."assessment_sessions" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."colleges" TO "authenticated";
GRANT ALL ON TABLE "public"."colleges" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."course_enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."course_enrollments" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."fsrs_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."fsrs_configs" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."fsrs_review_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."fsrs_review_logs" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."question_import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."question_import_batches" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."student_question_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."student_question_cards" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."student_topic_access" TO "authenticated";
GRANT ALL ON TABLE "public"."student_topic_access" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."topics" TO "authenticated";
GRANT ALL ON TABLE "public"."topics" TO "service_role";



GRANT ALL ON TABLE "public"."v_completed_session_review" TO "service_role";



GRANT ALL ON TABLE "public"."v_export_all_data" TO "service_role";



GRANT ALL ON TABLE "public"."v_session_results" TO "service_role";
GRANT SELECT ON TABLE "public"."v_session_results" TO "authenticated";



GRANT ALL ON TABLE "public"."v_student_topic_progress" TO "service_role";
GRANT SELECT ON TABLE "public"."v_student_topic_progress" TO "authenticated";



GRANT ALL ON TABLE "public"."v_student_course_progress" TO "service_role";
GRANT SELECT ON TABLE "public"."v_student_course_progress" TO "authenticated";



GRANT ALL ON TABLE "public"."v_student_topic_access_status" TO "service_role";
GRANT SELECT ON TABLE "public"."v_student_topic_access_status" TO "authenticated";



GRANT ALL ON TABLE "public"."v_teacher_students" TO "service_role";
GRANT SELECT ON TABLE "public"."v_teacher_students" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







