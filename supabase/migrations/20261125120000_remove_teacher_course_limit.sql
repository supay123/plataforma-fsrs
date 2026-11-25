-- Quita el máximo de 8 cursos no archivados por profesor; conserva la validación
-- de rol y colegio del profesor.
create or replace function public.validate_course_teacher()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  teacher_role public.app_user_role;
  teacher_college uuid;
begin
  select role, college_id into teacher_role, teacher_college
  from public.profiles
  where id = new.teacher_id;

  if teacher_role is distinct from 'teacher' then
    raise exception 'teacher_id must reference a teacher profile';
  end if;

  if teacher_college is distinct from new.college_id then
    raise exception 'teacher and course must belong to the same college';
  end if;

  return new;
end;
$$;

drop trigger courses_validate_teacher_and_limit on public.courses;
create trigger courses_validate_teacher
  before insert or update of teacher_id, college_id on public.courses
  for each row execute function public.validate_course_teacher();

drop function public.validate_course_teacher_and_limit();

comment on table public.courses is 'Courses owned by one teacher. No limit per teacher.';
