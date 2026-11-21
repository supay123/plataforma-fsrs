-- Medallas del estudiante.
--
-- Cada institución configura (1 a 1 con colleges) si las medallas están
-- activadas, los rangos de estrellas de cada medalla y las notas que dan o
-- quitan estrellas. Solo se guarda el umbral FINAL de cada rango; el inicio sale
-- del fin del anterior. Cada estudiante guarda su medalla y estrellas actuales
-- (1 a 1 con su perfil) y, por tema, su mejor marca de estrellas.
--
-- star_range_ends: fin de Postulante 1, 2, 3, Pre-Universitario 1, 2, 3,
--   Candidato 1, 2, 3 y Pre-Ingresante 1, 2, 3. Ingresante empieza en el último + 1.
--   Defecto {2,5,8,13,18,23,32,41,50,67,84,101}.
-- grade_range_ends: fin de las notas que dan -3, -2, -1, 0, +1 y +2 estrellas.
--   El rango de -3 empieza en 0 y el de +3 termina en 20. Defecto {2,5,8,9,13,17}.

create function public.medal_ends_are_valid(
  p_ends integer[],
  p_count integer,
  p_max integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array_length(p_ends, 1) = p_count
    and array_position(p_ends, null) is null
    and p_ends[1] >= 0
    and p_ends[p_count] <= p_max
    and not exists (
      select 1 from generate_subscripts(p_ends, 1) as idx
      where idx > 1 and p_ends[idx] <= p_ends[idx - 1]
    ),
    false
  );
$$;

create function public.medal_for_stars(p_stars integer, p_ends integer[])
returns text
language sql
immutable
set search_path = ''
as $$
  select (array[
    'postulante_1', 'postulante_2', 'postulante_3',
    'pre_universitario_1', 'pre_universitario_2', 'pre_universitario_3',
    'candidato_1', 'candidato_2', 'candidato_3',
    'pre_ingresante_1', 'pre_ingresante_2', 'pre_ingresante_3',
    'ingresante'
  ])[coalesce(
    (select min(idx)
     from generate_subscripts(p_ends, 1) as idx
     where p_stars <= p_ends[idx]),
    13
  )];
$$;

create table public.college_medal_settings (
  college_id uuid primary key references public.colleges(id) on delete cascade,
  enabled boolean not null default true,
  star_range_ends integer[] not null default '{2,5,8,13,18,23,32,41,50,67,84,101}',
  grade_range_ends integer[] not null default '{2,5,8,9,13,17}',
  updated_at timestamptz not null default now(),
  constraint college_medal_settings_star_ends_valid check (
    public.medal_ends_are_valid(star_range_ends, 12, 2147483646)
  ),
  constraint college_medal_settings_grade_ends_valid check (
    public.medal_ends_are_valid(grade_range_ends, 6, 19)
  )
);

comment on table public.college_medal_settings is
  'Medal configuration of a college (1 to 1): enabled flag, end of each star range and end of each grade range. Created with the college.';

create table public.student_medals (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  stars integer not null default 0,
  medal text not null default 'postulante_1',
  updated_at timestamptz not null default now(),
  constraint student_medals_stars_nonnegative check (stars >= 0)
);

comment on table public.student_medals is
  'Current medal and stars of a student (1 to 1 with the profile). Created with the student.';

create table public.student_topic_stars (
  student_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  best_stars smallint not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (student_id, topic_id),
  constraint student_topic_stars_range check (best_stars between 0 and 3)
);

comment on table public.student_topic_stars is
  'Best stars (0-3) a student reached in a topic of normal practice and whether the topic is completed (3 stars).';

create trigger college_medal_settings_set_updated_at
  before update on public.college_medal_settings
  for each row execute function public.set_updated_at();
create trigger student_medals_set_updated_at
  before update on public.student_medals
  for each row execute function public.set_updated_at();
create trigger student_topic_stars_set_updated_at
  before update on public.student_topic_stars
  for each row execute function public.set_updated_at();

alter table public.college_medal_settings enable row level security;
alter table public.student_medals enable row level security;
alter table public.student_topic_stars enable row level security;

create policy college_medal_settings_select on public.college_medal_settings
  for select to authenticated
  using (
    (select private.is_admin())
    or college_id = (select private.current_college_id())
  );
create policy college_medal_settings_insert on public.college_medal_settings
  for insert to authenticated
  with check ((select private.is_admin()));
create policy college_medal_settings_update on public.college_medal_settings
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy student_medals_select on public.student_medals
  for select to authenticated
  using (
    (select private.is_admin())
    or student_id = (select auth.uid())
    or (select private.teacher_can_view_student(student_id))
  );

create policy student_topic_stars_select on public.student_topic_stars
  for select to authenticated
  using (
    (select private.is_admin())
    or student_id = (select auth.uid())
    or (select private.teacher_can_view_student(student_id))
  );

-- Resultado de las medallas de cada sesión; null hasta que se calcula. Hace
-- idempotente el cálculo: repetirlo devuelve el mismo resultado sin sumar de nuevo.
alter table public.assessment_sessions
  add column medal_award jsonb;

-- Una fila de medallas por institución y por estudiante, siempre.
create function private.create_college_medal_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.college_medal_settings (college_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

create function private.create_student_medal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.student_medals (student_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger colleges_create_medal_settings
  after insert on public.colleges
  for each row execute function private.create_college_medal_settings();

create trigger profiles_create_student_medal
  after insert or update of role on public.profiles
  for each row
  when (new.role = 'student'::public.app_user_role)
  execute function private.create_student_medal();

insert into public.college_medal_settings (college_id)
select id from public.colleges
on conflict do nothing;

insert into public.student_medals (student_id)
select id from public.profiles
where role = 'student'::public.app_user_role
on conflict do nothing;

-- Aplica al estudiante el resultado de una sesión completada. p_stars_for_grade
-- (-3..3) lo calcula la Edge Function con la nota que ella misma obtuvo de la
-- sesión guardada; aquí se aplican las reglas por tema y se guarda todo en una
-- sola transacción:
--   1. Estrellas negativas: siempre restan (el total nunca baja de 0).
--   2. Tema sin completar: suma solo la diferencia con su mejor marca.
--   3. Tema completado (3): solo un resultado de +3 suma +1.
create function public.edge_apply_session_medal(
  p_student_id uuid,
  p_session_id uuid,
  p_grade numeric,
  p_stars_for_grade integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_session public.assessment_sessions%rowtype;
  student_college_id uuid;
  settings public.college_medal_settings;
  stored public.student_medals%rowtype;
  topic_stars public.student_topic_stars%rowtype;
  gain integer;
  new_best integer;
  new_stars integer;
  new_medal text;
  award jsonb;
begin
  if p_stars_for_grade not between -3 and 3 then
    raise exception 'invalid_stars_for_grade';
  end if;

  select * into target_session
  from public.assessment_sessions s
  where s.id = p_session_id
  for update;

  if target_session.id is null or target_session.student_id <> p_student_id then
    raise exception 'Session not found';
  end if;
  if target_session.status <> 'completed'::public.session_status then
    raise exception 'Only completed sessions can award medals';
  end if;
  if target_session.medal_award is not null then
    return target_session.medal_award;
  end if;

  select p.college_id into student_college_id
  from public.profiles p
  where p.id = p_student_id;

  insert into public.college_medal_settings (college_id)
  values (student_college_id)
  on conflict do nothing;
  select * into settings
  from public.college_medal_settings c
  where c.college_id = student_college_id;
  if not settings.enabled then
    return jsonb_build_object('enabled', false);
  end if;

  insert into public.student_medals (student_id)
  values (p_student_id)
  on conflict do nothing;
  select * into stored
  from public.student_medals m
  where m.student_id = p_student_id
  for update;

  insert into public.student_topic_stars (student_id, topic_id)
  values (p_student_id, target_session.topic_id)
  on conflict do nothing;
  select * into topic_stars
  from public.student_topic_stars t
  where t.student_id = p_student_id and t.topic_id = target_session.topic_id
  for update;

  new_best := topic_stars.best_stars;
  if p_stars_for_grade < 0 then
    gain := p_stars_for_grade;
  elsif not topic_stars.completed then
    gain := greatest(p_stars_for_grade - topic_stars.best_stars, 0);
    new_best := greatest(p_stars_for_grade, topic_stars.best_stars);
  elsif p_stars_for_grade = 3 then
    gain := 1;
  else
    gain := 0;
  end if;

  new_stars := greatest(stored.stars + gain, 0);
  new_medal := public.medal_for_stars(new_stars, settings.star_range_ends);

  update public.student_medals
  set stars = new_stars, medal = new_medal
  where student_id = p_student_id;

  update public.student_topic_stars
  set best_stars = new_best, completed = (new_best = 3)
  where student_id = p_student_id and topic_id = target_session.topic_id;

  award := jsonb_build_object(
    'enabled', true,
    'grade', p_grade,
    'stars_for_grade', p_stars_for_grade,
    'stars_delta', new_stars - stored.stars,
    'stars_before', stored.stars,
    'stars', new_stars,
    'medal_before', public.medal_for_stars(stored.stars, settings.star_range_ends),
    'medal', new_medal,
    'topic_id', target_session.topic_id,
    'topic_best_stars', new_best,
    'topic_completed', new_best = 3
  );

  update public.assessment_sessions
  set medal_award = award
  where id = p_session_id;

  return award;
end;
$$;

revoke all on function public.edge_apply_session_medal(uuid, uuid, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.edge_apply_session_medal(uuid, uuid, numeric, integer)
  to service_role;
