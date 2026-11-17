-- Racha de días activos del estudiante.
--
-- Un día cuenta como activo cuando el estudiante completa al menos una sesión.
-- Se guarda un registro por estudiante y día calendario de America/Lima (el día
-- se calcula en la base de datos para que no dependa de la zona del navegador
-- ni de la del servidor). La racha se calcula al consultar, a partir de estos días.

create table public.student_activity_days (
  student_id uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null,
  created_at timestamptz not null default now(),
  primary key (student_id, activity_date)
);

comment on table public.student_activity_days is
  'Days (calendar day in America/Lima) on which a student completed at least one session. One row per student and day; the streak is derived from it.';

alter table public.student_activity_days enable row level security;

create policy student_activity_days_select on public.student_activity_days
  for select to authenticated
  using (
    (select private.is_admin())
    or student_id = (select auth.uid())
    or (select private.teacher_can_view_student(student_id))
  );

-- Reutilizable por cualquier flujo que cuente como actividad (sesión normal
-- ahora; Modo Ruta después). Idempotente: varias llamadas el mismo día no duplican.
create function public.record_student_activity(
  p_student_id uuid,
  p_activity_at timestamptz default now()
)
returns date
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  activity_day date := (p_activity_at at time zone 'America/Lima')::date;
begin
  insert into public.student_activity_days (student_id, activity_date)
  values (p_student_id, activity_day)
  on conflict do nothing;
  return activity_day;
end;
$$;

revoke all on function public.record_student_activity(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_student_activity(uuid, timestamptz)
  to service_role;
