-- A teacher assignment is inferred from any enrollment row (active or inactive)
-- between a student and one of the teacher's courses. No additional relation
-- table is required.

create or replace function private.teacher_can_manage_enrollment(
  target_course_id uuid,
  target_student_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists(
      select 1
      from public.courses c
      join public.profiles student on student.id = target_student_id
      where c.id = target_course_id
        and c.teacher_id = (select auth.uid())
        and student.role = 'student'::public.app_user_role
        and student.college_id = c.college_id
        and private.is_teacher()
    ),
    false
  )
$$;

create or replace function public.admin_sync_teacher_students(
  p_teacher_id uuid,
  p_student_ids uuid[] default '{}'::uuid[]
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_college_id uuid;
  normalized_student_ids uuid[];
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can synchronize teacher assignments'
      using errcode = '42501';
  end if;

  select p.college_id
    into target_college_id
  from public.profiles p
  where p.id = p_teacher_id
    and p.role = 'teacher'::public.app_user_role;

  if target_college_id is null then
    raise exception 'The selected teacher does not exist or has no college';
  end if;

  if not exists (
    select 1
    from public.courses c
    where c.teacher_id = p_teacher_id
      and c.status <> 'archived'::public.course_status
  ) then
    raise exception 'The selected teacher must have at least one course before assigning students';
  end if;

  select coalesce(array_agg(distinct requested.student_id), '{}'::uuid[])
    into normalized_student_ids
  from unnest(coalesce(p_student_ids, '{}'::uuid[])) as requested(student_id)
  where requested.student_id is not null;

  if exists (
    select 1
    from unnest(normalized_student_ids) as requested(student_id)
    left join public.profiles student on student.id = requested.student_id
    where student.id is null
       or student.role <> 'student'::public.app_user_role
       or student.college_id is distinct from target_college_id
  ) then
    raise exception 'Every selected profile must be a student from the teacher college';
  end if;

  -- Serialize assignment changes with course creation for the same teacher so
  -- neither operation can miss enrollments created by the other transaction.
  perform pg_advisory_xact_lock(hashtextextended(p_teacher_id::text, 0));

  delete from public.course_enrollments ce
  using public.courses c
  where ce.course_id = c.id
    and c.teacher_id = p_teacher_id
    and not (ce.student_id = any(normalized_student_ids));

  insert into public.course_enrollments (
    course_id,
    student_id,
    status,
    enrolled_by,
    ended_at
  )
  select
    c.id,
    requested.student_id,
    'active'::public.enrollment_status,
    (select auth.uid()),
    null
  from public.courses c
  cross join unnest(normalized_student_ids) as requested(student_id)
  where c.teacher_id = p_teacher_id
    and c.status <> 'archived'::public.course_status
  on conflict (course_id, student_id) do nothing;
end;
$$;

revoke all on function public.admin_sync_teacher_students(uuid, uuid[]) from public;
revoke all on function public.admin_sync_teacher_students(uuid, uuid[]) from anon;
grant execute on function public.admin_sync_teacher_students(uuid, uuid[]) to authenticated;
grant execute on function public.admin_sync_teacher_students(uuid, uuid[]) to service_role;

drop policy if exists course_enrollments_delete on public.course_enrollments;
create policy course_enrollments_delete
  on public.course_enrollments
  for delete
  to authenticated
  using ((select private.is_admin()));

create or replace function public.sync_new_course_enrollments()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.teacher_id::text, 0));

  insert into public.course_enrollments (
    course_id,
    student_id,
    status,
    enrolled_by,
    ended_at
  )
  select
    new.id,
    assigned.student_id,
    'active'::public.enrollment_status,
    coalesce(new.created_by, (select auth.uid())),
    null
  from (
    select distinct ce.student_id
    from public.course_enrollments ce
    join public.courses existing_course on existing_course.id = ce.course_id
    where existing_course.teacher_id = new.teacher_id
      and existing_course.id <> new.id
  ) assigned
  on conflict (course_id, student_id) do nothing;

  return new;
end;
$$;

revoke all on function public.sync_new_course_enrollments() from public;
revoke all on function public.sync_new_course_enrollments() from anon;
revoke all on function public.sync_new_course_enrollments() from authenticated;

drop trigger if exists courses_sync_new_enrollments on public.courses;
create trigger courses_sync_new_enrollments
after insert on public.courses
for each row execute function public.sync_new_course_enrollments();

-- Backfill every inferred student-teacher assignment across all of the
-- teacher's current non-archived courses. Existing inactive rows are preserved.
with inferred_assignments as (
  select distinct existing_course.teacher_id, ce.student_id
  from public.course_enrollments ce
  join public.courses existing_course on existing_course.id = ce.course_id
)
insert into public.course_enrollments (
  course_id,
  student_id,
  status,
  enrolled_by,
  ended_at
)
select
  target_course.id,
  assignment.student_id,
  'active'::public.enrollment_status,
  target_course.created_by,
  null
from inferred_assignments assignment
join public.courses target_course
  on target_course.teacher_id = assignment.teacher_id
 and target_course.status <> 'archived'::public.course_status
on conflict (course_id, student_id) do nothing;

comment on function public.admin_sync_teacher_students(uuid, uuid[]) is
  'Atomically synchronizes the complete student selection for one teacher while preserving inactive course exceptions.';
comment on function public.sync_new_course_enrollments() is
  'Enrolls every student inferred as assigned to a teacher when that teacher creates a course.';
