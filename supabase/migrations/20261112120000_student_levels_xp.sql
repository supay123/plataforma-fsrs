-- Gamificación del estudiante: niveles y xp.
--
-- Del estudiante solo se guarda su nivel y el xp que lleva dentro de ese nivel
-- (nunca el total acumulado, que crece rápido). Los montos y la fórmula de
-- nivel se configuran por colegio. Pasar al nivel N cuesta
--   floor(base_xp + base_xp * (N - 1)^(1 + growth) * growth)
-- Ejemplo con base 100 y growth 0.2: 0→1 = 100, 1→2 = 120, 2→3 = 145.

create table public.college_xp_settings (
  college_id uuid primary key references public.colleges(id) on delete cascade,
  base_xp integer not null default 100,
  growth double precision not null default 0.2,
  xp_per_correct integer not null default 75,
  streak_3_bonus integer not null default 15,
  streak_7_bonus integer not null default 42,
  streak_20_bonus integer not null default 137,
  updated_at timestamptz not null default now(),
  constraint college_xp_settings_base_range check (base_xp between 1 and 100000),
  constraint college_xp_settings_growth_range check (growth >= 0 and growth <= 5),
  constraint college_xp_settings_amounts_range check (
    xp_per_correct between 0 and 10000
    and streak_3_bonus between 0 and 10000
    and streak_7_bonus between 0 and 10000
    and streak_20_bonus between 0 and 10000
  )
);

comment on table public.college_xp_settings is
  'XP amounts and level formula of a college. Missing rows are created with the defaults by edge_college_xp_rules.';

create table public.student_levels (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  level integer not null default 0,
  xp integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint student_levels_nonnegative check (level >= 0 and xp >= 0)
);

comment on table public.student_levels is
  'Current level of a student and the xp earned inside that level (not the lifetime total).';

alter table public.college_xp_settings enable row level security;
alter table public.student_levels enable row level security;

create policy college_xp_settings_select on public.college_xp_settings
  for select to authenticated
  using ((select private.is_admin()));
create policy college_xp_settings_insert on public.college_xp_settings
  for insert to authenticated
  with check ((select private.is_admin()));
create policy college_xp_settings_update on public.college_xp_settings
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy student_levels_select on public.student_levels
  for select to authenticated
  using (
    (select private.is_admin())
    or student_id = (select auth.uid())
  );

-- Resultado del xp de cada sesión; null hasta que se otorga. Hace idempotente
-- el cierre: reenviar una sesión ya cerrada devuelve el mismo resultado.
alter table public.assessment_sessions
  add column xp_award jsonb;

insert into public.college_xp_settings (college_id)
select id from public.colleges
on conflict do nothing;

-- XP necesario para pasar al nivel p_next_level.
create function public.xp_for_level(
  p_next_level integer,
  p_base integer,
  p_growth double precision
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select floor(
    p_base + p_base * power((p_next_level - 1)::double precision, 1 + p_growth) * p_growth
  )::integer;
$$;

-- Reglas de un colegio; si aún no tiene fila se crea con los valores por defecto.
create function public.edge_college_xp_rules(p_college_id uuid)
returns public.college_xp_settings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  rules public.college_xp_settings;
begin
  insert into public.college_xp_settings (college_id)
  values (p_college_id)
  on conflict do nothing;

  select * into rules
  from public.college_xp_settings
  where college_id = p_college_id;
  return rules;
end;
$$;

-- Reglas del colegio del estudiante más su nivel actual, para pintar el xp
-- durante la sesión y el punto de partida de la barra.
create function public.edge_student_xp_state(p_student_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  student_college_id uuid;
  rules public.college_xp_settings;
  current_level integer;
  current_xp integer;
begin
  select p.college_id into student_college_id
  from public.profiles p
  where p.id = p_student_id and p.role = 'student'::public.app_user_role;
  if student_college_id is null then
    raise exception 'student_not_found';
  end if;

  rules := public.edge_college_xp_rules(student_college_id);

  select l.level, l.xp into current_level, current_xp
  from public.student_levels l
  where l.student_id = p_student_id;

  return jsonb_build_object(
    'xp_per_correct', rules.xp_per_correct,
    'streak_3_bonus', rules.streak_3_bonus,
    'streak_7_bonus', rules.streak_7_bonus,
    'streak_20_bonus', rules.streak_20_bonus,
    'level', coalesce(current_level, 0),
    'xp', coalesce(current_xp, 0),
    'xp_to_next', public.xp_for_level(
      coalesce(current_level, 0) + 1, rules.base_xp, rules.growth
    )
  );
end;
$$;

-- Suma p_xp al estudiante, sube los niveles que correspondan y guarda el
-- resultado en la sesión (una sola vez por sesión). thresholds trae el xp que
-- costaba cada paso: el primero es para pasar del nivel inicial al siguiente y
-- el último, el que falta para el siguiente nivel del nivel final.
create function public.edge_award_session_xp(
  p_student_id uuid,
  p_session_id uuid,
  p_xp integer
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
  rules public.college_xp_settings;
  stored public.student_levels%rowtype;
  new_level integer;
  remaining integer;
  need integer;
  steps jsonb := '[]'::jsonb;
  award jsonb;
begin
  if p_xp < 0 then
    raise exception 'xp_cannot_be_negative';
  end if;

  select * into target_session
  from public.assessment_sessions s
  where s.id = p_session_id
  for update;

  if target_session.id is null or target_session.student_id <> p_student_id then
    raise exception 'Session not found';
  end if;
  if target_session.status <> 'completed'::public.session_status then
    raise exception 'Only completed sessions can award xp';
  end if;
  if target_session.xp_award is not null then
    return target_session.xp_award;
  end if;

  select p.college_id into student_college_id
  from public.profiles p
  where p.id = p_student_id;
  rules := public.edge_college_xp_rules(student_college_id);

  insert into public.student_levels (student_id)
  values (p_student_id)
  on conflict do nothing;

  select * into stored
  from public.student_levels l
  where l.student_id = p_student_id
  for update;

  new_level := stored.level;
  remaining := stored.xp + p_xp;
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

  award := jsonb_build_object(
    'xp_gained', p_xp,
    'level_before', stored.level,
    'xp_before', stored.xp,
    'level', new_level,
    'xp', remaining,
    'thresholds', steps
  );

  update public.assessment_sessions
  set xp_award = award
  where id = p_session_id;

  return award;
end;
$$;

revoke all on function public.edge_college_xp_rules(uuid)
  from public, anon, authenticated;
revoke all on function public.edge_student_xp_state(uuid)
  from public, anon, authenticated;
revoke all on function public.edge_award_session_xp(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.edge_college_xp_rules(uuid) to service_role;
grant execute on function public.edge_student_xp_state(uuid) to service_role;
grant execute on function public.edge_award_session_xp(uuid, uuid, integer)
  to service_role;
