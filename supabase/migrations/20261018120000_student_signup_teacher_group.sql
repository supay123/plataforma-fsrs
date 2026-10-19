-- Autoservicio: el estudiante que se registra elige su grupo (un profesor) en
-- vez de su institución. La institución sale del profesor y, al activarse la
-- cuenta, el estudiante queda inscrito en todos los cursos del profesor. Los
-- cursos que el profesor cree después se le asignan solos
-- (sync_new_course_enrollments infiere la asignación de las inscripciones).
--
-- Aditivo: teacher_id es opcional, así que los registros pendientes creados
-- antes de esta migración se siguen activando como antes (sin cursos).

alter table public.student_registrations
  add column teacher_id uuid references public.profiles (id) on delete set null;

comment on column public.student_registrations.teacher_id is
  'Teacher (group) chosen at sign-up. On activation the student is enrolled in all of the teacher''s courses. Set null if the teacher is deleted, so a paid registration still activates.';

create index student_registrations_teacher_id_idx
  on public.student_registrations (teacher_id);

-- Profesores que puede elegir quien se registra: activos, de un colegio activo
-- y con al menos un curso vigente. Sin cursos no habría inscripción de la cual
-- inferir la asignación, y el estudiante no recibiría los cursos futuros.
create function public.edge_registration_teachers()
returns table (teacher_id uuid, teacher_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name
  from public.profiles p
  join public.colleges c on c.id = p.college_id
  where p.role = 'teacher'::public.app_user_role
    and p.is_active
    and c.is_active
    and exists (
      select 1 from public.courses co
      where co.teacher_id = p.id
        and co.status <> 'archived'::public.course_status
    )
  order by p.full_name
$$;

drop function public.edge_create_student_registration(
  uuid, text, text, text, text, public.identity_document_type, text, text, uuid
);

-- Igual que antes, pero recibe el profesor y toma de él la institución.
create function public.edge_create_student_registration(
  p_teacher_id uuid,
  p_given_names text,
  p_family_names text,
  p_email text,
  p_phone text,
  p_identity_document_type public.identity_document_type,
  p_identity_document_number text,
  p_password_hash text,
  p_replaces_registration_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  teacher_college_id uuid;
begin
  select p.college_id into teacher_college_id
  from public.edge_registration_teachers() t
  join public.profiles p on p.id = t.teacher_id
  where t.teacher_id = p_teacher_id;
  if teacher_college_id is null then
    raise exception 'invalid_teacher';
  end if;

  delete from public.student_registrations r where r.expires_at <= now();
  if p_replaces_registration_id is not null then
    delete from public.student_registrations r where r.id = p_replaces_registration_id;
  end if;
  delete from public.student_registrations r
  where lower(btrim(r.email)) = lower(btrim(p_email));

  if exists (
    select 1 from public.profiles p
    where lower(btrim(p.email)) = lower(btrim(p_email))
  ) or exists (
    select 1 from auth.users u
    where lower(u.email) = lower(btrim(p_email))
  ) then
    raise exception 'email_taken';
  end if;

  insert into public.student_registrations (
    college_id, teacher_id, given_names, family_names, email, phone,
    identity_document_type, identity_document_number, password_hash
  )
  values (
    teacher_college_id, p_teacher_id, btrim(p_given_names), btrim(p_family_names),
    lower(btrim(p_email)), btrim(p_phone), p_identity_document_type,
    btrim(p_identity_document_number), p_password_hash
  )
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    -- Dos registros simultáneos con el mismo correo.
    raise exception 'registration_conflict';
end;
$$;

-- Igual que antes, y además inscribe al estudiante en los cursos del profesor
-- elegido, en la misma transacción que crea el perfil.
create or replace function public.edge_activate_student_registration(
  p_payment_id uuid,
  p_user_id uuid,
  p_user_code text,
  p_access_valid_from date,
  p_access_valid_until date
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  payment public.plan_payments%rowtype;
  registration public.student_registrations%rowtype;
begin
  select * into payment
  from public.plan_payments p
  where p.id = p_payment_id
  for update;

  if payment.id is null then
    raise exception 'payment_not_found';
  end if;
  if payment.status <> 'succeeded' then
    raise exception 'payment_not_succeeded';
  end if;
  if payment.applied_at is not null then
    raise exception 'payment_already_applied';
  end if;

  select * into registration
  from public.student_registrations r
  where r.id = payment.registration_id
  for update;

  if registration.id is null then
    raise exception 'registration_not_found';
  end if;
  if registration.email_verified_at is null then
    raise exception 'email_not_verified';
  end if;

  delete from public.student_registrations r where r.id = registration.id;

  insert into public.profiles (
    id, college_id, role, user_code, full_name, given_names, family_names,
    email, phone, identity_document_type, identity_document_number,
    is_active, access_valid_from, access_valid_until
  )
  values (
    p_user_id, registration.college_id, 'student', btrim(p_user_code),
    registration.given_names || ' ' || registration.family_names,
    registration.given_names, registration.family_names, registration.email,
    registration.phone, registration.identity_document_type,
    registration.identity_document_number, true, p_access_valid_from,
    p_access_valid_until
  );

  if registration.teacher_id is not null then
    -- Se serializa con la creación de cursos del mismo profesor, como
    -- admin_sync_teacher_students, para no perder un curso creado a la vez.
    perform pg_advisory_xact_lock(hashtextextended(registration.teacher_id::text, 0));

    insert into public.course_enrollments (course_id, student_id, status, enrolled_by, ended_at)
    select c.id, p_user_id, 'active'::public.enrollment_status, null, null
    from public.courses c
    where c.teacher_id = registration.teacher_id
      and c.college_id = registration.college_id
      and c.status <> 'archived'::public.course_status
    on conflict (course_id, student_id) do nothing;
  end if;

  update public.plan_payments p
  set profile_id = p_user_id,
    applied_at = now(),
    period_start = p_access_valid_from,
    period_end = p_access_valid_until
  where p.id = payment.id;

  return p_user_id;
end;
$$;

revoke all on function public.edge_registration_teachers() from public, anon, authenticated;
revoke all on function public.edge_create_student_registration(
  uuid, text, text, text, text, public.identity_document_type, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.edge_activate_student_registration(uuid, uuid, text, date, date)
  from public, anon, authenticated;

grant execute on function public.edge_registration_teachers() to service_role;
grant execute on function public.edge_create_student_registration(
  uuid, text, text, text, text, public.identity_document_type, text, text, uuid
) to service_role;
grant execute on function public.edge_activate_student_registration(uuid, uuid, text, date, date)
  to service_role;
