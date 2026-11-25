-- Modo ruta: cada profesor puede tener varios cursos de ruta. Son independientes
-- de `courses` (los de "Mi aprendizaje"): no dependen de sus matrículas.
--
-- Los temas pasan a colgar de un curso de ruta. Para no perder nada, cada
-- profesor que ya tenía temas recibe un curso "Ruta principal" con todos ellos;
-- las lecciones, preguntas, intentos y xp cuelgan del tema y no cambian.
-- Los estudiantes ven los cursos de ruta de sus profesores (como antes veían
-- sus temas), por eso la política de lectura usa el mismo criterio.

create table public.route_courses (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  position integer not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_courses_name_not_blank check (btrim(name) <> ''),
  constraint route_courses_position_positive check (position > 0)
);

comment on table public.route_courses is
  'Cursos del modo ruta de un profesor. Cada uno tiene su propia fila de temas y lecciones; no tienen relación con public.courses.';

create unique index route_courses_teacher_name_unique_ci
  on public.route_courses (teacher_id, lower(btrim(name)));
create index route_courses_teacher_id_idx on public.route_courses (teacher_id, position);
create index route_courses_college_id_idx on public.route_courses (college_id);

alter table public.route_courses enable row level security;

create policy route_courses_select on public.route_courses
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
          and c.teacher_id = route_courses.teacher_id
      )
    )
  );

alter table public.route_topics
  add column route_course_id uuid references public.route_courses(id) on delete cascade;

insert into public.route_courses (college_id, teacher_id, name, position)
select distinct on (teacher_id) college_id, teacher_id, 'Ruta principal', 1
from public.route_topics
order by teacher_id, created_at;

update public.route_topics topic
set route_course_id = course.id
from public.route_courses course
where course.teacher_id = topic.teacher_id;

alter table public.route_topics
  alter column route_course_id set not null;

comment on column public.route_topics.route_course_id is
  'Curso de ruta al que pertenece el tema. position es el orden dentro de ese curso.';

create index route_topics_route_course_id_idx on public.route_topics (route_course_id, position);
