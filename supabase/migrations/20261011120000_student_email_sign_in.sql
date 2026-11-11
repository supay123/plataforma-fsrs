-- Los estudiantes que se registran solos inician sesión con su correo. Su
-- código de usuario (que la aplicación sigue usando para identificarlos) se
-- genera al activar la cuenta, así que el registro pendiente ya no reserva uno.

alter table public.student_registrations alter column user_code drop not null;

comment on column public.student_registrations.user_code is
  'Legacy reservation column; self-registered students get a generated code on activation.';

-- Búsqueda indexada por correo para el inicio de sesión, igual que
-- edge_find_profile_by_code.
create or replace function public.edge_find_profile_by_email(p_email text)
returns table (
  id uuid,
  college_id uuid,
  role public.app_user_role,
  user_code text,
  full_name text,
  is_active boolean,
  access_valid_from date,
  access_valid_until date
)
language sql
stable
set search_path = ''
as $$
  select
    p.id,
    p.college_id,
    p.role,
    p.user_code,
    p.full_name,
    p.is_active,
    p.access_valid_from,
    p.access_valid_until
  from public.profiles p
  where p.email is not null
    and lower(btrim(p.email)) = lower(btrim(p_email))
  limit 1
$$;

revoke all on function public.edge_find_profile_by_email(text) from public, anon, authenticated;
grant execute on function public.edge_find_profile_by_email(text) to service_role;

drop function public.edge_create_student_registration(
  uuid, text, text, text, text, public.identity_document_type, text, text, text
);

-- Crea el registro pendiente. Reemplaza el registro anterior del mismo
-- navegador (p_replaces_registration_id, cuando el usuario vuelve a corregir
-- sus datos) y cualquier registro previo con el mismo correo.
create function public.edge_create_student_registration(
  p_college_id uuid,
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
begin
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
    college_id, given_names, family_names, email, phone,
    identity_document_type, identity_document_number, password_hash
  )
  values (
    p_college_id, btrim(p_given_names), btrim(p_family_names), lower(btrim(p_email)),
    btrim(p_phone), p_identity_document_type, btrim(p_identity_document_number),
    p_password_hash
  )
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    -- Dos registros simultáneos con el mismo correo.
    raise exception 'registration_conflict';
end;
$$;

drop function public.edge_activate_student_registration(uuid, uuid, date, date);

-- Convierte un registro verificado en perfil de estudiante con el código que
-- generó la Edge Function. La cuenta de auth.users ya existe con el mismo id.
create function public.edge_activate_student_registration(
  p_registration_id uuid,
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
  registration public.student_registrations%rowtype;
begin
  select * into registration
  from public.student_registrations r
  where r.id = p_registration_id
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

  return p_user_id;
end;
$$;

revoke all on function public.edge_create_student_registration(
  uuid, text, text, text, text, public.identity_document_type, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.edge_activate_student_registration(uuid, uuid, text, date, date)
  from public, anon, authenticated;

grant execute on function public.edge_create_student_registration(
  uuid, text, text, text, text, public.identity_document_type, text, text, uuid
) to service_role;
grant execute on function public.edge_activate_student_registration(uuid, uuid, text, date, date)
  to service_role;
