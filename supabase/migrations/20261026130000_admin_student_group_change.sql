-- El administrador puede cambiar el grupo (profesor) de un estudiante. El
-- estudiante deja los cursos del grupo anterior y su progreso en ellos se
-- conserva 7 días: si vuelve a alguno de esos cursos antes, no se borra.

-- Progreso por borrar. Solo lo usa service_role desde las Edge Functions y el
-- job de limpieza.
create table public.student_progress_purges (
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  purge_after timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (student_id, course_id)
);

create index student_progress_purges_course_id_idx
  on public.student_progress_purges (course_id);
create index student_progress_purges_purge_after_idx
  on public.student_progress_purges (purge_after);

alter table public.student_progress_purges enable row level security;

comment on table public.student_progress_purges is
  'Progress (sessions and FSRS cards) of a student in a course they left when an administrator changed their group. It is deleted after purge_after unless the student is active in that course again.';

-- Cambia el grupo en una sola transacción: deja los cursos de otros
-- profesores, programa el borrado de su progreso, inscribe al estudiante en
-- los cursos no archivados del nuevo profesor y toma de él la institución.
create function public.edge_change_student_group(
  p_student_id uuid,
  p_teacher_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  teacher_college_id uuid;
begin
  perform 1
  from public.profiles p
  where p.id = p_student_id
    and p.role = 'student'::public.app_user_role
  for update;
  if not found then
    raise exception 'user_not_found';
  end if;

  select p.college_id into teacher_college_id
  from public.edge_registration_teachers() t
  join public.profiles p on p.id = t.teacher_id
  where t.teacher_id = p_teacher_id;
  if teacher_college_id is null then
    raise exception 'invalid_teacher';
  end if;

  -- Se serializa con la creación de cursos del mismo profesor, como en la
  -- activación del autoservicio, para no perder un curso creado a la vez.
  perform pg_advisory_xact_lock(hashtextextended(p_teacher_id::text, 0));

  with left_courses as (
    update public.course_enrollments e
    set status = 'inactive'::public.enrollment_status, ended_at = now()
    from public.courses c
    where c.id = e.course_id
      and e.student_id = p_student_id
      and e.status = 'active'::public.enrollment_status
      and c.teacher_id <> p_teacher_id
    returning e.course_id
  )
  insert into public.student_progress_purges (student_id, course_id, purge_after)
  select p_student_id, l.course_id, now() + interval '7 days'
  from left_courses l
  on conflict (student_id, course_id)
    do update set purge_after = excluded.purge_after;

  with joined_courses as (
    insert into public.course_enrollments (
      course_id, student_id, status, enrolled_by, ended_at
    )
    select c.id, p_student_id, 'active'::public.enrollment_status, p_actor_id, null
    from public.courses c
    where c.teacher_id = p_teacher_id
      and c.college_id = teacher_college_id
      and c.status <> 'archived'::public.course_status
    on conflict (course_id, student_id) do update
      set status = 'active'::public.enrollment_status, ended_at = null
    returning course_id
  )
  -- Volver a un curso antes de los 7 días conserva su progreso.
  delete from public.student_progress_purges s
  using joined_courses j
  where s.student_id = p_student_id and s.course_id = j.course_id;

  update public.profiles
  set college_id = teacher_college_id
  where id = p_student_id;

  return teacher_college_id;
end;
$$;

revoke all on function public.edge_change_student_group(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.edge_change_student_group(uuid, uuid, uuid)
  to service_role;

comment on function public.edge_change_student_group(uuid, uuid, uuid) is
  'Moves a student to another group (teacher) in one transaction: ends the enrollments in other teachers'' courses and schedules their progress for deletion in 7 days, enrolls the student in the new teacher''s non-archived courses and takes the college from the teacher. Returns the new college id.';

-- Borra el progreso vencido. Las respuestas de las sesiones y los registros
-- FSRS se borran en cascada. Si el estudiante volvió a estar activo en el
-- curso (por ejemplo, desde Asignaciones), se conserva.
create function private.purge_student_progress()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from public.student_progress_purges s
  using public.course_enrollments e
  where e.student_id = s.student_id
    and e.course_id = s.course_id
    and e.status = 'active'::public.enrollment_status;

  delete from public.assessment_sessions a
  using public.student_progress_purges s
  where s.purge_after <= now()
    and a.student_id = s.student_id
    and a.course_id = s.course_id;

  delete from public.student_question_cards card
  using public.student_progress_purges s, public.questions q, public.topics t
  where s.purge_after <= now()
    and card.student_id = s.student_id
    and q.id = card.question_id
    and t.id = q.topic_id
    and t.course_id = s.course_id;

  delete from public.student_progress_purges s where s.purge_after <= now();
end;
$$;

revoke all on function private.purge_student_progress() from public, anon, authenticated;

select cron.schedule(
  'purge-student-progress-after-group-change',
  '41 * * * *',
  $$select private.purge_student_progress()$$
);
