-- Sessions always contain 20 unique questions. Existing in-progress sessions
-- are topped up without changing their current positions or answers.
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
  active_question_count integer;
  existing_question_count integer;
  questions_to_add integer;
  next_position integer;
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception 'Session size must be between 1 and 20';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_student_id::text || ':' || p_topic_id::text, 0)
  );

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

  select count(*) into active_question_count
  from public.questions q
  where q.topic_id = p_topic_id
    and q.status = 'active'::public.question_status;

  if active_question_count < p_limit then
    raise exception 'insufficient_active_questions:required=%,available=%',
      p_limit, active_question_count;
  end if;

  select s.id into existing_session_id
  from public.assessment_sessions s
  where s.student_id = p_student_id
    and s.topic_id = p_topic_id
    and s.status = 'in_progress'::public.session_status
  order by s.started_at desc
  limit 1;

  if existing_session_id is not null then
    select count(*), coalesce(max(sq.position), 0)
    into existing_question_count, next_position
    from public.assessment_session_questions sq
    where sq.session_id = existing_session_id;

    questions_to_add := greatest(p_limit - existing_question_count, 0);

    if questions_to_add > 0 then
      with candidates as (
        select
          q.id as question_id,
          case
            when card.due_at <= now() then 'due'::public.question_selection_reason
            when card.id is null then 'new'::public.question_selection_reason
            else 'scheduled'::public.question_selection_reason
          end as selection_reason,
          card.due_at as due_at_snapshot,
          case when card.due_at <= now() then 0 when card.id is null then 1 else 2 end as priority,
          case when card.id is null then random() else 0 end as random_order
        from public.questions q
        left join public.student_question_cards card
          on card.student_id = p_student_id
         and card.question_id = q.id
        where q.topic_id = p_topic_id
          and q.status = 'active'::public.question_status
          and not exists (
            select 1
            from public.assessment_session_questions existing
            where existing.session_id = existing_session_id
              and existing.question_id = q.id
          )
      ), selected as (
        select *
        from candidates
        order by
          priority,
          case when priority in (0, 2) then due_at_snapshot end asc nulls last,
          random_order,
          question_id
        limit questions_to_add
      ), positioned as (
        select
          selected.*,
          next_position + row_number() over (order by random()) as position
        from selected
      )
      insert into public.assessment_session_questions (
        session_id,
        question_id,
        position,
        selection_reason,
        due_at_snapshot
      )
      select
        existing_session_id,
        question_id,
        position,
        selection_reason,
        due_at_snapshot
      from positioned;
    end if;

    select count(*) into existing_question_count
    from public.assessment_session_questions sq
    where sq.session_id = existing_session_id;

    if existing_question_count <> p_limit then
      raise exception 'Unable to fill session to requested size';
    end if;

    update public.assessment_sessions
    set total_questions = p_limit
    where id = existing_session_id;

    return existing_session_id;
  end if;

  select id into active_config_id
  from public.fsrs_configs
  where is_active
  limit 1;

  if active_config_id is null then
    raise exception 'No active FSRS configuration exists';
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
    p_limit
  )
  returning id into created_session_id;

  with candidates as (
    select
      q.id as question_id,
      case
        when card.due_at <= now() then 'due'::public.question_selection_reason
        when card.id is null then 'new'::public.question_selection_reason
        else 'scheduled'::public.question_selection_reason
      end as selection_reason,
      card.due_at as due_at_snapshot,
      case when card.due_at <= now() then 0 when card.id is null then 1 else 2 end as priority,
      case when card.id is null then random() else 0 end as random_order
    from public.questions q
    left join public.student_question_cards card
      on card.student_id = p_student_id
     and card.question_id = q.id
    where q.topic_id = p_topic_id
      and q.status = 'active'::public.question_status
  ), selected as (
    select *
    from candidates
    order by
      priority,
      case when priority in (0, 2) then due_at_snapshot end asc nulls last,
      random_order,
      question_id
    limit p_limit
  ), positioned as (
    select
      selected.*,
      row_number() over (order by random()) as position
    from selected
  )
  insert into public.assessment_session_questions (
    session_id,
    question_id,
    position,
    selection_reason,
    due_at_snapshot
  )
  select
    created_session_id,
    question_id,
    position,
    selection_reason,
    due_at_snapshot
  from positioned;

  return created_session_id;
end;
$$;

-- Apply every previously-unanswered response and complete the session in one
-- transaction. p_results is produced only by the authenticated Edge Function.
create or replace function public.edge_submit_and_complete_session(
  p_student_id uuid,
  p_session_id uuid,
  p_results jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  target_session public.assessment_sessions%rowtype;
  target record;
  old_card public.student_question_cards%rowtype;
  saved_card_id uuid;
  item jsonb;
  item_count integer;
  unanswered_count integer;
  matching_count integer;
  distinct_count integer;
  submitted_option character(1);
  submitted_response_time integer;
  submitted_reviewed_at timestamptz;
  submitted_card jsonb;
  expected_correct boolean;
  expected_rating public.fsrs_rating;
begin
  select * into target_session
  from public.assessment_sessions s
  where s.id = p_session_id
  for update;

  if target_session.id is null or target_session.student_id <> p_student_id then
    raise exception 'Session not found';
  end if;

  if target_session.status = 'completed'::public.session_status then
    return target_session.id;
  end if;

  if target_session.status <> 'in_progress'::public.session_status then
    raise exception 'Only in-progress sessions can be completed';
  end if;

  if jsonb_typeof(p_results) <> 'array' then
    raise exception 'Results must be a JSON array';
  end if;

  item_count := jsonb_array_length(p_results);

  select count(*) into unanswered_count
  from public.assessment_session_questions sq
  where sq.session_id = p_session_id
    and sq.selected_option is null;

  if item_count <> unanswered_count then
    raise exception 'Every unanswered session question must be submitted exactly once';
  end if;

  select count(*), count(distinct result->>'session_question_id')
  into matching_count, distinct_count
  from jsonb_array_elements(p_results) result
  join public.assessment_session_questions sq
    on sq.id = (result->>'session_question_id')::uuid
   and sq.session_id = p_session_id
   and sq.selected_option is null;

  if matching_count <> item_count or distinct_count <> item_count then
    raise exception 'Submitted results contain unknown or duplicate session questions';
  end if;

  for item in select value from jsonb_array_elements(p_results)
  loop
    submitted_option := upper(btrim(item->>'selected_option'))::character(1);
    submitted_response_time := (item->>'response_time_ms')::integer;
    submitted_reviewed_at := (item->>'reviewed_at')::timestamptz;
    submitted_card := item->'card';

    if submitted_option not in ('A', 'B', 'C', 'D') then
      raise exception 'Selected option must be A, B, C, or D';
    end if;
    if submitted_response_time is null or submitted_response_time < 0 then
      raise exception 'Response time cannot be negative';
    end if;
    if submitted_reviewed_at is null then
      raise exception 'Reviewed timestamp is required';
    end if;
    if (submitted_card->>'due') is null
      or (submitted_card->>'state') is null
      or (submitted_card->>'reps') is null
      or (submitted_card->>'lapses') is null then
      raise exception 'Incomplete FSRS card state';
    end if;

    select
      sq.id,
      sq.question_id,
      q.correct_option
    into target
    from public.assessment_session_questions sq
    join public.questions q on q.id = sq.question_id
    where sq.id = (item->>'session_question_id')::uuid
      and sq.session_id = p_session_id
      and sq.selected_option is null
    for update of sq;

    if target.id is null then
      raise exception 'Session question is no longer available for submission';
    end if;

    select * into old_card
    from public.student_question_cards card
    where card.student_id = p_student_id
      and card.question_id = target.question_id
    for update;

    expected_correct := submitted_option = target.correct_option;
    expected_rating := case
      when expected_correct then 'Good'::public.fsrs_rating
      else 'Again'::public.fsrs_rating
    end;

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
      target_session.fsrs_config_id,
      (submitted_card->>'due')::timestamptz,
      nullif(submitted_card->>'stability', '')::numeric,
      nullif(submitted_card->>'difficulty', '')::numeric,
      coalesce((submitted_card->>'elapsed_days')::integer, 0),
      coalesce((submitted_card->>'scheduled_days')::integer, 0),
      coalesce((submitted_card->>'learning_steps')::integer, 0),
      (submitted_card->>'reps')::integer,
      (submitted_card->>'lapses')::integer,
      (submitted_card->>'state')::smallint,
      nullif(submitted_card->>'last_review', '')::timestamptz,
      submitted_card
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
      selected_option = submitted_option,
      is_correct = expected_correct,
      fsrs_rating = expected_rating,
      answered_at = submitted_reviewed_at,
      response_time_ms = submitted_response_time
    where id = target.id;

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
      target.id,
      p_student_id,
      target.question_id,
      target_session.fsrs_config_id,
      expected_rating,
      submitted_reviewed_at,
      old_card.due_at,
      (submitted_card->>'due')::timestamptz,
      old_card.stability,
      nullif(submitted_card->>'stability', '')::numeric,
      old_card.difficulty,
      nullif(submitted_card->>'difficulty', '')::numeric,
      old_card.state,
      (submitted_card->>'state')::smallint,
      old_card.scheduled_days,
      coalesce((submitted_card->>'scheduled_days')::integer, 0)
    );
  end loop;

  update public.assessment_sessions s
  set
    status = 'completed'::public.session_status,
    completed_at = now(),
    answered_questions = counts.answered_questions,
    correct_count = counts.correct_count,
    incorrect_count = counts.incorrect_count
  from (
    select
      count(*) filter (where sq.selected_option is not null)::integer as answered_questions,
      count(*) filter (where sq.is_correct)::integer as correct_count,
      count(*) filter (where sq.is_correct = false)::integer as incorrect_count
    from public.assessment_session_questions sq
    where sq.session_id = p_session_id
  ) counts
  where s.id = p_session_id
    and counts.answered_questions = s.total_questions;

  if not found then
    raise exception 'All session questions must be answered';
  end if;

  return p_session_id;
end;
$$;

revoke all on function public.edge_submit_and_complete_session(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.edge_submit_and_complete_session(uuid, uuid, jsonb)
  to service_role;
