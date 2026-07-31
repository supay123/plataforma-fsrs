-- A teacher's INSERT ... RETURNING could not pass the SELECT policy because
-- teacher_owns_course(id) queried courses again before the inserted row was
-- visible to that helper. Check ownership directly against the policy row.

drop policy if exists courses_select on public.courses;

create policy courses_select
on public.courses
for select
to authenticated
using (
  (select private.is_admin())
  or (
    (select private.is_teacher())
    and teacher_id = (select auth.uid())
    and status <> 'archived'::public.course_status
  )
  or (
    (select private.has_valid_student_access())
    and private.student_is_enrolled(id)
  )
);
