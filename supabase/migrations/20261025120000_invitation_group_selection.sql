-- Invitaciones: el administrador puede fijar el grupo (profesor) del estudiante,
-- igual que en el autoservicio. Si no lo fija, el estudiante elige su grupo al
-- aceptar la invitación. La institución siempre sale del profesor.
--
-- Aditivo: college_id deja de ser obligatorio y teacher_id es opcional. Las
-- invitaciones antiguas (solo college_id) se siguen aceptando y limitan los
-- grupos que puede elegir el estudiante a los de esa institución.

alter table public.student_invitations
  add column teacher_id uuid references public.profiles (id) on delete set null;

comment on column public.student_invitations.teacher_id is
  'Teacher (group) fixed by the administrator. When null, the student chooses an eligible group while accepting the invitation.';

alter table public.student_invitations
  alter column college_id drop not null,
  add constraint student_invitations_teacher_requires_college
    check (teacher_id is null or college_id is not null);

create index student_invitations_teacher_id_idx
  on public.student_invitations (teacher_id);

-- Misma lista que usa el autoservicio, ahora con la institución de cada grupo.
-- Cambia el tipo de retorno, así que hay que recrear la función.
drop function public.edge_registration_teachers();

create function public.edge_registration_teachers()
returns table (
  teacher_id uuid,
  teacher_name text,
  college_id uuid,
  college_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.college_id, c.name
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

revoke all on function public.edge_registration_teachers()
  from public, anon, authenticated;
grant execute on function public.edge_registration_teachers() to service_role;

-- Acepta una invitación en una sola transacción: valida el grupo, toma de él la
-- institución, consume la invitación, crea el perfil y matricula al estudiante
-- en los cursos vigentes del profesor. Si algo falla, la invitación no se
-- pierde (todo vuelve atrás).
create function public.edge_accept_student_invitation(
  p_invitation_id uuid,
  p_user_id uuid,
  p_user_code text,
  p_given_names text,
  p_family_names text,
  p_email text,
  p_phone text,
  p_identity_document_type public.identity_document_type,
  p_identity_document_number text,
  p_teacher_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  invitation public.student_invitations%rowtype;
  effective_teacher_id uuid;
  teacher_college_id uuid;
begin
  select * into invitation
  from public.student_invitations i
  where i.id = p_invitation_id
  for update;

  if invitation.id is null then
    raise exception 'invalid_invitation';
  end if;
  if p_email is null
    or lower(btrim(p_email)) <> lower(btrim(invitation.email)) then
    raise exception 'invalid_invitation';
  end if;

  if invitation.teacher_id is not null then
    -- Grupo fijado por el administrador: se respeta aunque el profesor ya no
    -- aparezca en la lista pública (por ejemplo, si perdió sus cursos).
    effective_teacher_id := invitation.teacher_id;
    select p.college_id into teacher_college_id
    from public.profiles p
    where p.id = effective_teacher_id
      and p.role = 'teacher'::public.app_user_role;
    if teacher_college_id is null then
      raise exception 'invalid_teacher';
    end if;
  else
    if p_teacher_id is null then
      raise exception 'teacher_required';
    end if;
    effective_teacher_id := p_teacher_id;
    select p.college_id into teacher_college_id
    from public.edge_registration_teachers() t
    join public.profiles p on p.id = t.teacher_id
    where t.teacher_id = p_teacher_id;
    if teacher_college_id is null then
      raise exception 'invalid_teacher';
    end if;
    -- Invitaciones antiguas: el administrador fijó la institución, así que el
    -- grupo elegido tiene que pertenecer a ella.
    if invitation.college_id is not null
      and teacher_college_id <> invitation.college_id then
      raise exception 'invalid_teacher';
    end if;
  end if;

  -- Consumir la invitación: si dos pedidos llegan a la vez, solo uno la
  -- encuentra y el otro recibe invalid_invitation.
  delete from public.student_invitations i where i.id = invitation.id;

  insert into public.profiles (
    id, college_id, role, user_code, full_name, given_names, family_names,
    email, phone, identity_document_type, identity_document_number,
    is_active, access_valid_from, access_valid_until, created_by
  )
  values (
    p_user_id, teacher_college_id, 'student', btrim(p_user_code),
    btrim(p_given_names) || ' ' || btrim(p_family_names),
    btrim(p_given_names), btrim(p_family_names), invitation.email,
    btrim(p_phone), p_identity_document_type, btrim(p_identity_document_number),
    true, invitation.access_valid_from, invitation.access_valid_until,
    invitation.invited_by
  );

  if effective_teacher_id is not null then
    -- Se serializa con la creación de cursos del mismo profesor, como en la
    -- activación del autoservicio, para no perder un curso creado a la vez.
    perform pg_advisory_xact_lock(
      hashtextextended(effective_teacher_id::text, 0)
    );

    insert into public.course_enrollments (
      course_id, student_id, status, enrolled_by, ended_at
    )
    select c.id, p_user_id, 'active'::public.enrollment_status, null, null
    from public.courses c
    where c.teacher_id = effective_teacher_id
      and c.college_id = teacher_college_id
      and c.status <> 'archived'::public.course_status
    on conflict (course_id, student_id) do nothing;
  end if;

  insert into public.audit_logs (
    actor_user_id, college_id, action, entity_type, entity_id, metadata
  )
  values (
    p_user_id, teacher_college_id, 'invitation.accepted', 'profile', p_user_id,
    '{}'::jsonb
  );

  return p_user_id;
end;
$$;

revoke all on function public.edge_accept_student_invitation(
  uuid, uuid, text, text, text, text, text,
  public.identity_document_type, text, uuid
) from public, anon, authenticated;
grant execute on function public.edge_accept_student_invitation(
  uuid, uuid, text, text, text, text, text,
  public.identity_document_type, text, uuid
) to service_role;

comment on function public.edge_accept_student_invitation(
  uuid, uuid, text, text, text, text, text,
  public.identity_document_type, text, uuid
) is
  'Consumes a student invitation and, in one transaction, creates the student profile, derives the college from the group and enrolls the student in the group''s active courses. The group is the invitation''s teacher or, for invitations without one, the eligible teacher chosen by the student.';
