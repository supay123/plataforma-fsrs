-- Mover un curso a otro profesor y duplicarlo (solo administradores).
-- Los triggers existentes validan que el profesor sea del mismo colegio y los
-- límites (25 temas por curso, 50 preguntas por tema).

create or replace function public.admin_move_course(
  p_course_id uuid,
  p_teacher_id uuid
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_teacher_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can move courses' using errcode = '42501';
  end if;

  select teacher_id into old_teacher_id
  from public.courses
  where id = p_course_id and status <> 'archived'::public.course_status;

  if old_teacher_id is null then
    raise exception 'The course does not exist';
  end if;
  if old_teacher_id = p_teacher_id then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_teacher_id::text, 0));

  -- Valida mismo colegio y límite de cursos del nuevo profesor.
  update public.courses set teacher_id = p_teacher_id where id = p_course_id;

  -- Los estudiantes se asignan por profesor: se reemplazan por los del nuevo.
  delete from public.course_enrollments where course_id = p_course_id;

  insert into public.course_enrollments (course_id, student_id, status, enrolled_by, ended_at)
  select p_course_id, assigned.student_id, 'active'::public.enrollment_status, (select auth.uid()), null
  from (
    select distinct ce.student_id
    from public.course_enrollments ce
    join public.courses other on other.id = ce.course_id
    where other.teacher_id = p_teacher_id
      and other.id <> p_course_id
  ) assigned
  on conflict (course_id, student_id) do nothing;
end;
$$;

create or replace function public.admin_duplicate_course(p_course_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source public.courses;
  new_course_id uuid;
  topic_row record;
  new_topic_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can duplicate courses' using errcode = '42501';
  end if;

  select * into source
  from public.courses
  where id = p_course_id and status <> 'archived'::public.course_status;

  if source.id is null then
    raise exception 'The course does not exist';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(source.teacher_id::text, 0));

  -- El trigger de inserción matricula a los estudiantes del profesor.
  insert into public.courses (college_id, teacher_id, name, description, status, created_by)
  values (source.college_id, source.teacher_id, source.name || ' - duplicado', source.description, source.status, (select auth.uid()))
  returning id into new_course_id;

  for topic_row in
    select * from public.topics
    where course_id = p_course_id and status <> 'archived'::public.topic_status
    order by position
  loop
    insert into public.topics (course_id, name, description, material_url, position, status, created_by)
    values (new_course_id, topic_row.name, topic_row.description, topic_row.material_url, topic_row.position, topic_row.status, (select auth.uid()))
    returning id into new_topic_id;

    insert into public.questions (topic_id, statement, option_a, option_b, option_c, option_d, correct_option, explanation, status, created_by)
    select new_topic_id, q.statement, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation, q.status, (select auth.uid())
    from public.questions q
    where q.topic_id = topic_row.id and q.status <> 'archived'::public.question_status;
  end loop;

  return new_course_id;
end;
$$;

revoke all on function public.admin_move_course(uuid, uuid) from public, anon;
revoke all on function public.admin_duplicate_course(uuid) from public, anon;
grant execute on function public.admin_move_course(uuid, uuid) to authenticated, service_role;
grant execute on function public.admin_duplicate_course(uuid) to authenticated, service_role;

comment on function public.admin_move_course(uuid, uuid) is
  'Mueve un curso a otro profesor del mismo colegio y reasigna los estudiantes del nuevo profesor.';
comment on function public.admin_duplicate_course(uuid) is
  'Duplica un curso con sus temas y preguntas, sin progreso de estudiantes; el nombre termina en " - duplicado".';
