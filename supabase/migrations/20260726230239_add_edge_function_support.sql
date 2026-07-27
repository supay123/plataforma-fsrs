-- Backend support for the authenticated Edge Function API.
-- Privileged RPCs remain invoker-security and executable only by service_role.

create or replace function private.has_valid_student_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select
        private.is_student()
        and p.access_valid_from is not null
        and p.access_valid_until is not null
        and (now() at time zone 'America/Lima')::date
          between p.access_valid_from and p.access_valid_until
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

create or replace function private.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.role = 'teacher'::public.app_user_role and p.is_active
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

create or replace function public.validate_topic_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_count integer;
begin
  if new.status <> 'archived'::public.topic_status then
    select count(*) into current_count
    from public.topics
    where course_id = new.course_id
      and status <> 'archived'::public.topic_status
      and id <> new.id;

    if current_count >= 10 then
      raise exception 'A course can have at most 10 non-archived topics';
    end if;
  end if;

  return new;
end;
$$;

alter function public.set_updated_at() set search_path = '';
alter function public.validate_assessment_session() set search_path = '';
alter function public.validate_course_enrollment() set search_path = '';
alter function public.validate_course_teacher_and_limit() set search_path = '';
alter function public.validate_question_limit() set search_path = '';
alter function public.validate_session_question() set search_path = '';
alter function public.validate_student_topic_access() set search_path = '';

create unique index assessment_sessions_one_in_progress_per_student_topic_idx
  on public.assessment_sessions (student_id, topic_id)
  where status = 'in_progress'::public.session_status;

insert into public.fsrs_configs (
  name,
  library_name,
  library_version,
  parameters,
  rating_mapping,
  is_active,
  locked_at
)
select
  'FSRS v6 pilot',
  'ts-fsrs',
  '5.4.1',
  '{}'::jsonb,
  '{"correct":"Good","incorrect":"Again"}'::jsonb,
  true,
  now()
where not exists (
  select 1 from public.fsrs_configs where is_active
);

create or replace function public.edge_start_session(
  p_student_id uuid,
  p_topic_id uuid,
  p_limit integer default 20
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  target_course_id uuid;
  active_config_id uuid;
  existing_session_id uuid;
  created_session_id uuid;
  selected_count integer;
  selected_question_ids uuid[];
  selected_reasons public.question_selection_reason[];
  selected_due_dates timestamptz[];
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception 'Session size must be between 1 and 20';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_student_id::text || ':' || p_topic_id::text, 0)
  );

  select s.id into existing_session_id
  from public.assessment_sessions s
  where s.student_id = p_student_id
    and s.topic_id = p_topic_id
    and s.status = 'in_progress'::public.session_status
  order by s.started_at desc
  limit 1;

  if existing_session_id is not null then
    return existing_session_id;
  end if;

  select t.course_id into target_course_id
  from public.topics t
  join public.courses c on c.id = t.course_id
  join public.profiles p on p.id = p_student_id
  join public.course_enrollments ce
    on ce.course_id = c.id
   and ce.student_id = p_student_id
   and ce.status = 'active'::public.enrollment_status
  where t.id = p_topic_id
    and t.status = 'active'::public.topic_status
    and c.status = 'active'::public.course_status
    and p.role = 'student'::public.app_user_role
    and p.is_active
    and p.access_valid_from is not null
    and p.access_valid_until is not null
    and (now() at time zone 'America/Lima')::date
      between p.access_valid_from and p.access_valid_until
    and not exists (
      select 1
      from public.student_topic_access sta
      where sta.student_id = p_student_id
        and sta.topic_id = p_topic_id
        and sta.is_blocked
    );

  if target_course_id is null then
    raise exception 'Student cannot access this topic';
  end if;

  select id into active_config_id
  from public.fsrs_configs
  where is_active
  limit 1;

  if active_config_id is null then
    raise exception 'No active FSRS configuration exists';
  end if;

  select
    array_agg(selected.question_id order by selected.priority, selected.sort_at, selected.question_id),
    array_agg(selected.selection_reason order by selected.priority, selected.sort_at, selected.question_id),
    array_agg(selected.due_at_snapshot order by selected.priority, selected.sort_at, selected.question_id)
  into selected_question_ids, selected_reasons, selected_due_dates
  from (
    select candidates.*
    from (
      select
        q.id as question_id,
        'due'::public.question_selection_reason as selection_reason,
        card.due_at as due_at_snapshot,
        0 as priority,
        card.due_at as sort_at
      from public.student_question_cards card
      join public.questions q on q.id = card.question_id
      where card.student_id = p_student_id
        and q.topic_id = p_topic_id
        and q.status = 'active'::public.question_status
        and card.due_at <= now()

      union all

      select
        q.id as question_id,
        'new'::public.question_selection_reason as selection_reason,
        null::timestamptz as due_at_snapshot,
        1 as priority,
        q.created_at as sort_at
      from public.questions q
      where q.topic_id = p_topic_id
        and q.status = 'active'::public.question_status
        and not exists (
          select 1
          from public.student_question_cards card
          where card.student_id = p_student_id
            and card.question_id = q.id
        )
    ) candidates
    order by candidates.priority, candidates.sort_at, candidates.question_id
    limit p_limit
  ) selected;

  selected_count := coalesce(cardinality(selected_question_ids), 0);

  if selected_count = 0 then
    raise exception 'No due or new questions are available for this topic';
  end if;

  insert into public.assessment_sessions (
    student_id,
    course_id,
    topic_id,
    fsrs_config_id,
    total_questions
  )
  values (
    p_student_id,
    target_course_id,
    p_topic_id,
    active_config_id,
    selected_count
  )
  returning id into created_session_id;

  insert into public.assessment_session_questions (
    session_id,
    question_id,
    position,
    selection_reason,
    due_at_snapshot
  )
  select
    created_session_id,
    selected.question_id,
    row_number() over (order by random())::integer,
    selected.selection_reason,
    selected.due_at_snapshot
  from unnest(
    selected_question_ids,
    selected_reasons,
    selected_due_dates
  ) as selected(question_id, selection_reason, due_at_snapshot);

  return created_session_id;
end;
$$;

create or replace function public.edge_apply_answer(
  p_student_id uuid,
  p_session_question_id uuid,
  p_selected_option character,
  p_response_time_ms integer,
  p_reviewed_at timestamptz,
  p_card jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  target record;
  old_card public.student_question_cards%rowtype;
  saved_card_id uuid;
  expected_correct boolean;
  expected_rating public.fsrs_rating;
begin
  if p_selected_option not in ('A', 'B', 'C', 'D') then
    raise exception 'Selected option must be A, B, C, or D';
  end if;

  if p_response_time_ms is not null and p_response_time_ms < 0 then
    raise exception 'Response time cannot be negative';
  end if;

  select
    sq.id,
    sq.question_id,
    sq.selected_option,
    s.id as session_id,
    s.student_id,
    s.fsrs_config_id,
    s.status,
    q.correct_option
  into target
  from public.assessment_session_questions sq
  join public.assessment_sessions s on s.id = sq.session_id
  join public.questions q on q.id = sq.question_id
  where sq.id = p_session_question_id
  for update of sq, s;

  if target.id is null or target.student_id <> p_student_id then
    raise exception 'Session question not found';
  end if;

  if target.selected_option is not null then
    return jsonb_build_object(
      'status', 'already_answered',
      'session_id', target.session_id
    );
  end if;

  if target.status <> 'in_progress'::public.session_status then
    raise exception 'Only in-progress sessions can be answered';
  end if;

  select * into old_card
  from public.student_question_cards card
  where card.student_id = p_student_id
    and card.question_id = target.question_id
  for update;

  expected_correct := p_selected_option = target.correct_option;
  expected_rating := case
    when expected_correct then 'Good'::public.fsrs_rating
    else 'Again'::public.fsrs_rating
  end;

  if (p_card->>'due') is null
    or (p_card->>'state') is null
    or (p_card->>'reps') is null
    or (p_card->>'lapses') is null then
    raise exception 'Incomplete FSRS card state';
  end if;

  insert into public.student_question_cards (
    student_id,
    question_id,
    fsrs_config_id,
    due_at,
    stability,
    difficulty,
    elapsed_days,
    scheduled_days,
    learning_steps,
    reps,
    lapses,
    state,
    last_review_at,
    fsrs_data
  )
  values (
    p_student_id,
    target.question_id,
    target.fsrs_config_id,
    (p_card->>'due')::timestamptz,
    nullif(p_card->>'stability', '')::numeric,
    nullif(p_card->>'difficulty', '')::numeric,
    coalesce((p_card->>'elapsed_days')::integer, 0),
    coalesce((p_card->>'scheduled_days')::integer, 0),
    coalesce((p_card->>'learning_steps')::integer, 0),
    (p_card->>'reps')::integer,
    (p_card->>'lapses')::integer,
    (p_card->>'state')::smallint,
    nullif(p_card->>'last_review', '')::timestamptz,
    p_card
  )
  on conflict (student_id, question_id) do update set
    fsrs_config_id = excluded.fsrs_config_id,
    due_at = excluded.due_at,
    stability = excluded.stability,
    difficulty = excluded.difficulty,
    elapsed_days = excluded.elapsed_days,
    scheduled_days = excluded.scheduled_days,
    learning_steps = excluded.learning_steps,
    reps = excluded.reps,
    lapses = excluded.lapses,
    state = excluded.state,
    last_review_at = excluded.last_review_at,
    fsrs_data = excluded.fsrs_data
  returning id into saved_card_id;

  update public.assessment_session_questions
  set
    selected_option = p_selected_option,
    is_correct = expected_correct,
    fsrs_rating = expected_rating,
    answered_at = p_reviewed_at,
    response_time_ms = p_response_time_ms
  where id = p_session_question_id;

  insert into public.fsrs_review_logs (
    card_id,
    session_question_id,
    student_id,
    question_id,
    fsrs_config_id,
    rating,
    reviewed_at,
    due_before,
    due_after,
    stability_before,
    stability_after,
    difficulty_before,
    difficulty_after,
    state_before,
    state_after,
    scheduled_days_before,
    scheduled_days_after
  )
  values (
    saved_card_id,
    p_session_question_id,
    p_student_id,
    target.question_id,
    target.fsrs_config_id,
    expected_rating,
    p_reviewed_at,
    old_card.due_at,
    (p_card->>'due')::timestamptz,
    old_card.stability,
    nullif(p_card->>'stability', '')::numeric,
    old_card.difficulty,
    nullif(p_card->>'difficulty', '')::numeric,
    old_card.state,
    (p_card->>'state')::smallint,
    old_card.scheduled_days,
    coalesce((p_card->>'scheduled_days')::integer, 0)
  );

  update public.assessment_sessions
  set
    answered_questions = answered_questions + 1,
    correct_count = correct_count + case when expected_correct then 1 else 0 end,
    incorrect_count = incorrect_count + case when expected_correct then 0 else 1 end
  where id = target.session_id;

  return jsonb_build_object(
    'status', 'accepted',
    'session_id', target.session_id
  );
end;
$$;

create or replace function public.edge_complete_session(
  p_student_id uuid,
  p_session_id uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  target public.assessment_sessions%rowtype;
begin
  select * into target
  from public.assessment_sessions s
  where s.id = p_session_id
  for update;

  if target.id is null or target.student_id <> p_student_id then
    raise exception 'Session not found';
  end if;

  if target.status = 'completed'::public.session_status then
    return target.id;
  end if;

  if target.status <> 'in_progress'::public.session_status then
    raise exception 'Only in-progress sessions can be completed';
  end if;

  if target.answered_questions <> target.total_questions then
    raise exception 'All session questions must be answered';
  end if;

  update public.assessment_sessions
  set status = 'completed'::public.session_status,
      completed_at = now()
  where id = target.id;

  return target.id;
end;
$$;

create or replace function public.edge_import_questions(
  p_actor_id uuid,
  p_topic_id uuid,
  p_filename text,
  p_rows jsonb,
  p_total_rows integer,
  p_report jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target_course public.courses%rowtype;
  batch_id uuid;
  row_count integer;
  current_count integer;
begin
  select * into actor
  from public.profiles
  where id = p_actor_id;

  select c.* into target_course
  from public.topics t
  join public.courses c on c.id = t.course_id
  where t.id = p_topic_id;

  if actor.id is null or not actor.is_active then
    raise exception 'Active actor profile required';
  end if;

  if actor.role <> 'admin'::public.app_user_role
    and not (
      actor.role = 'teacher'::public.app_user_role
      and target_course.teacher_id = actor.id
    ) then
    raise exception 'Actor cannot import questions for this topic';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows must be a JSON array';
  end if;

  row_count := jsonb_array_length(p_rows);
  if row_count < 1 then
    raise exception 'At least one valid question is required';
  end if;

  if p_total_rows < row_count then
    raise exception 'Total rows cannot be smaller than accepted rows';
  end if;

  select count(*) into current_count
  from public.questions
  where topic_id = p_topic_id
    and status <> 'archived'::public.question_status;

  if current_count + row_count > 50 then
    raise exception 'Import would exceed the 50-question topic limit';
  end if;

  insert into public.question_import_batches (
    topic_id,
    uploaded_by,
    filename,
    total_rows,
    accepted_rows,
    rejected_rows,
    status,
    validation_report,
    completed_at
  )
  values (
    p_topic_id,
    p_actor_id,
    p_filename,
    p_total_rows,
    row_count,
    p_total_rows - row_count,
    'completed'::public.import_status,
    coalesce(p_report, '[]'::jsonb),
    now()
  )
  returning id into batch_id;

  insert into public.questions (
    topic_id,
    import_batch_id,
    statement,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_option,
    explanation,
    status,
    created_by
  )
  select
    p_topic_id,
    batch_id,
    btrim(row_data->>'pregunta'),
    btrim(row_data->>'respuesta_a'),
    btrim(row_data->>'respuesta_b'),
    btrim(row_data->>'respuesta_c'),
    btrim(row_data->>'respuesta_d'),
    upper(btrim(row_data->>'respuesta_correcta'))::character(1),
    nullif(btrim(row_data->>'explicacion'), ''),
    'active'::public.question_status,
    p_actor_id
  from jsonb_array_elements(p_rows) as row_data;

  insert into public.audit_logs (
    actor_user_id,
    college_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_actor_id,
    target_course.college_id,
    'questions.imported',
    'question_import_batch',
    batch_id,
    jsonb_build_object('topic_id', p_topic_id, 'rows', row_count)
  );

  return batch_id;
end;
$$;

create or replace function public.edge_find_profile_by_code(p_code text)
returns table (
  id uuid,
  college_id uuid,
  role public.app_user_role,
  user_code text,
  full_name text,
  is_active boolean,
  access_valid_from date,
  access_valid_until date
)
language sql
stable
set search_path = ''
as $$
  select
    p.id,
    p.college_id,
    p.role,
    p.user_code,
    p.full_name,
    p.is_active,
    p.access_valid_from,
    p.access_valid_until
  from public.profiles p
  where lower(btrim(p.user_code)) = lower(btrim(p_code))
  limit 1
$$;

revoke all on function public.edge_start_session(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.edge_apply_answer(uuid, uuid, character, integer, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.edge_complete_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.edge_import_questions(uuid, uuid, text, jsonb, integer, jsonb) from public, anon, authenticated;
revoke all on function public.edge_find_profile_by_code(text) from public, anon, authenticated;

grant execute on function public.edge_start_session(uuid, uuid, integer) to service_role;
grant execute on function public.edge_apply_answer(uuid, uuid, character, integer, timestamptz, jsonb) to service_role;
grant execute on function public.edge_complete_session(uuid, uuid) to service_role;
grant execute on function public.edge_import_questions(uuid, uuid, text, jsonb, integer, jsonb) to service_role;
grant execute on function public.edge_find_profile_by_code(text) to service_role;

-- Cover every foreign key that does not already have a left-prefixed index.
-- Besides improving joins, these indexes keep parent updates and deletes from
-- taking avoidable locks as the pilot data set grows.
create index assessment_sessions_fsrs_config_idx
  on public.assessment_sessions (fsrs_config_id);
create index course_enrollments_enrolled_by_idx
  on public.course_enrollments (enrolled_by);
create index courses_created_by_idx
  on public.courses (created_by);
create index fsrs_review_logs_fsrs_config_idx
  on public.fsrs_review_logs (fsrs_config_id);
create index profiles_created_by_idx
  on public.profiles (created_by);
create index question_import_batches_uploaded_by_idx
  on public.question_import_batches (uploaded_by);
create index questions_created_by_idx
  on public.questions (created_by);
create index student_question_cards_fsrs_config_idx
  on public.student_question_cards (fsrs_config_id);
create index student_topic_access_topic_idx
  on public.student_topic_access (topic_id);
create index student_topic_access_updated_by_idx
  on public.student_topic_access (updated_by);
create index topics_created_by_idx
  on public.topics (created_by);
