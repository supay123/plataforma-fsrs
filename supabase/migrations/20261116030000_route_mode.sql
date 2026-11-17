-- Modo ruta: temas con lecciones que se desbloquean en orden.
--
-- Los temas pertenecen a un profesor (su grupo). Cada lección tiene un texto y
-- exactamente 5 preguntas; para pasar a la siguiente hay que acertar al menos
-- el 80% (4 de 5). Las preguntas son propias del modo ruta (no son las de
-- `questions`) y no alimentan el repaso FSRS. El xp se otorga una sola vez por
-- pregunta y estudiante, la primera vez que la responde bien.
--
-- Toda escritura y lectura de contenido pasa por la edge function route-mode
-- (service_role): las políticas solo cubren lo que se lee directo. Los
-- estudiantes no tienen política sobre lecciones ni preguntas para que nunca
-- lean las respuestas correctas ni lecciones bloqueadas por PostgREST.

create table public.route_topics (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  position integer not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_topics_name_not_blank check (btrim(name) <> ''),
  constraint route_topics_position_positive check (position > 0)
);

comment on table public.route_topics is
  'Temas del modo ruta de un profesor (grupo). Se muestran como Tema 1, Tema 2... según position.';

create index route_topics_teacher_id_idx on public.route_topics (teacher_id, position);
create index route_topics_college_id_idx on public.route_topics (college_id);

create table public.route_lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.route_topics(id) on delete cascade,
  position integer not null,
  title text not null,
  content_text text not null,
  is_ready boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_lessons_title_not_blank check (btrim(title) <> ''),
  constraint route_lessons_content_not_blank check (btrim(content_text) <> ''),
  constraint route_lessons_position_positive check (position > 0)
);

comment on table public.route_lessons is
  'Lecciones de un tema de ruta. content_text admite saltos de línea y KaTeX. is_ready pasa a true al guardar las 5 preguntas; solo las lecciones listas las ven los estudiantes.';

create index route_lessons_topic_id_idx on public.route_lessons (topic_id, position);

create table public.route_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.route_lessons(id) on delete cascade,
  position smallint not null,
  statement text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option character(1) not null,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_questions_position_range check (position between 1 and 5),
  constraint route_questions_lesson_position_unique unique (lesson_id, position),
  constraint route_questions_correct_option_valid check (correct_option in ('A', 'B', 'C', 'D')),
  constraint route_questions_statement_not_blank check (btrim(statement) <> ''),
  constraint route_questions_options_not_blank check (
    btrim(option_a) <> '' and btrim(option_b) <> ''
    and btrim(option_c) <> '' and btrim(option_d) <> ''
  )
);

comment on table public.route_questions is
  'Las 5 preguntas de una lección de ruta. Independientes de questions y del repaso FSRS.';

create table public.route_lesson_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.route_lessons(id) on delete cascade,
  correct_count smallint not null,
  total_questions smallint not null,
  score_percent smallint not null,
  passed boolean not null,
  answers jsonb not null,
  xp_gained integer not null default 0,
  created_at timestamptz not null default now(),
  constraint route_lesson_attempts_counts check (
    correct_count >= 0 and total_questions > 0 and correct_count <= total_questions
  ),
  constraint route_lesson_attempts_percent check (score_percent between 0 and 100)
);

comment on table public.route_lesson_attempts is
  'Cada intento de una lección de ruta. passed = score_percent >= 80.';

create index route_lesson_attempts_student_lesson_idx
  on public.route_lesson_attempts (student_id, lesson_id);

create table public.route_question_xp_awards (
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.route_questions(id) on delete cascade,
  xp integer not null,
  awarded_at timestamptz not null default now(),
  primary key (student_id, question_id)
);

comment on table public.route_question_xp_awards is
  'Pregunta de ruta que ya dio xp a un estudiante: en los reintentos no vuelve a darlo.';

alter table public.route_topics enable row level security;
alter table public.route_lessons enable row level security;
alter table public.route_questions enable row level security;
alter table public.route_lesson_attempts enable row level security;
alter table public.route_question_xp_awards enable row level security;

create policy route_topics_select on public.route_topics
  for select to authenticated
  using (
    (select private.is_admin())
    or teacher_id = (select auth.uid())
    or (
      (select private.is_student())
      and exists (
        select 1
        from public.course_enrollments e
        join public.courses c on c.id = e.course_id
        where e.student_id = (select auth.uid())
          and e.status = 'active'::public.enrollment_status
          and c.teacher_id = route_topics.teacher_id
      )
    )
  );

create policy route_lessons_select on public.route_lessons
  for select to authenticated
  using (
    exists (
      select 1 from public.route_topics t
      where t.id = route_lessons.topic_id
        and ((select private.is_admin()) or t.teacher_id = (select auth.uid()))
    )
  );

create policy route_questions_select on public.route_questions
  for select to authenticated
  using (
    exists (
      select 1
      from public.route_lessons l
      join public.route_topics t on t.id = l.topic_id
      where l.id = route_questions.lesson_id
        and ((select private.is_admin()) or t.teacher_id = (select auth.uid()))
    )
  );

create policy route_lesson_attempts_select on public.route_lesson_attempts
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.is_admin())
    or exists (
      select 1
      from public.route_lessons l
      join public.route_topics t on t.id = l.topic_id
      where l.id = route_lesson_attempts.lesson_id
        and t.teacher_id = (select auth.uid())
    )
  );

create policy route_question_xp_awards_select on public.route_question_xp_awards
  for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_admin()));

-- Guarda un intento ya calificado por la edge function y otorga el xp. Las
-- preguntas bien respondidas que aún no dieron xp se registran con
-- on conflict do nothing, así que dos envíos simultáneos no pagan dos veces.
-- Devuelve el mismo formato de resultado de xp que edge_award_session_xp.
create function public.edge_record_route_attempt(
  p_student_id uuid,
  p_lesson_id uuid,
  p_answers jsonb,
  p_correct_question_ids uuid[],
  p_total_questions integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  student_college_id uuid;
  rules public.college_xp_settings;
  stored public.student_levels%rowtype;
  correct_total integer := coalesce(cardinality(p_correct_question_ids), 0);
  percent integer;
  newly_awarded integer;
  xp_total integer;
  new_level integer;
  remaining integer;
  need integer;
  steps jsonb := '[]'::jsonb;
  attempt_id uuid;
  did_pass boolean;
begin
  if p_total_questions <= 0 or correct_total > p_total_questions then
    raise exception 'invalid_route_attempt';
  end if;

  select p.college_id into student_college_id
  from public.profiles p
  where p.id = p_student_id and p.role = 'student'::public.app_user_role;
  if student_college_id is null then
    raise exception 'student_not_found';
  end if;
  rules := public.edge_college_xp_rules(student_college_id);

  with inserted as (
    insert into public.route_question_xp_awards (student_id, question_id, xp)
    select p_student_id, q.id, rules.xp_per_correct
    from public.route_questions q
    where q.id = any (p_correct_question_ids)
      and q.lesson_id = p_lesson_id
    on conflict do nothing
    returning 1
  )
  select count(*) into newly_awarded from inserted;
  xp_total := newly_awarded * rules.xp_per_correct;

  percent := floor(correct_total * 100.0 / p_total_questions);
  did_pass := percent >= 80;

  insert into public.route_lesson_attempts (
    student_id, lesson_id, correct_count, total_questions,
    score_percent, passed, answers, xp_gained
  )
  values (
    p_student_id, p_lesson_id, correct_total, p_total_questions,
    percent, did_pass, p_answers, xp_total
  )
  returning id into attempt_id;

  insert into public.student_levels (student_id)
  values (p_student_id)
  on conflict do nothing;

  select * into stored
  from public.student_levels l
  where l.student_id = p_student_id
  for update;

  new_level := stored.level;
  remaining := stored.xp + xp_total;
  loop
    need := public.xp_for_level(new_level + 1, rules.base_xp, rules.growth);
    steps := steps || to_jsonb(need);
    exit when remaining < need;
    remaining := remaining - need;
    new_level := new_level + 1;
  end loop;

  update public.student_levels
  set level = new_level, xp = remaining, updated_at = now()
  where student_id = p_student_id;

  return jsonb_build_object(
    'attempt_id', attempt_id,
    'correct_count', correct_total,
    'total_questions', p_total_questions,
    'score_percent', percent,
    'passed', did_pass,
    'xp', jsonb_build_object(
      'xp_gained', xp_total,
      'level_before', stored.level,
      'xp_before', stored.xp,
      'level', new_level,
      'xp', remaining,
      'thresholds', steps
    )
  );
end;
$$;

revoke all on function public.edge_record_route_attempt(uuid, uuid, jsonb, uuid[], integer)
  from public, anon, authenticated;
grant execute on function public.edge_record_route_attempt(uuid, uuid, jsonb, uuid[], integer)
  to service_role;
