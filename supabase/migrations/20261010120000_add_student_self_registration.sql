-- Autorregistro de estudiantes.
--
-- Todo es aditivo: las columnas nuevas de profiles son opcionales, así que los
-- perfiles creados por el administrador no cambian. Los datos del formulario
-- se guardan en student_registrations hasta que se confirma el pago; recién
-- entonces se crean la cuenta y el perfil.

create type public.identity_document_type as enum ('DNI', 'CE', 'PASAPORTE', 'RUC');

alter table public.profiles
  add column given_names text,
  add column family_names text,
  add column email text,
  add column phone text,
  add column identity_document_type public.identity_document_type,
  add column identity_document_number text,
  add constraint profiles_given_names_not_blank
    check (given_names is null or btrim(given_names) <> ''),
  add constraint profiles_family_names_not_blank
    check (family_names is null or btrim(family_names) <> ''),
  add constraint profiles_names_complete
    check ((given_names is null) = (family_names is null)),
  add constraint profiles_email_not_blank
    check (email is null or btrim(email) <> ''),
  add constraint profiles_phone_not_blank
    check (phone is null or btrim(phone) <> ''),
  add constraint profiles_identity_document_complete
    check ((identity_document_type is null) = (identity_document_number is null));

create unique index profiles_email_unique_ci
  on public.profiles (lower(btrim(email)))
  where email is not null;

comment on column public.profiles.email is
  'Contact and sign-in email of self-registered students. Matches auth.users.email for them; null for accounts created by an administrator.';

-- full_name sigue siendo la columna que usa toda la aplicación. Cuando el
-- perfil tiene nombres y apellidos, se compone a partir de ellos.
create or replace function private.profiles_compose_full_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.given_names is not null and new.family_names is not null then
    new.full_name := btrim(new.given_names) || ' ' || btrim(new.family_names);
  end if;
  return new;
end;
$$;

create trigger profiles_compose_full_name
  before insert or update of given_names, family_names, full_name
  on public.profiles
  for each row execute function private.profiles_compose_full_name();

-- Registros pendientes de pago. Solo los usa service_role desde las Edge
-- Functions; la contraseña se guarda únicamente como hash bcrypt.
create table public.student_registrations (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges (id) on delete cascade,
  given_names text not null,
  family_names text not null,
  email text not null,
  phone text not null,
  identity_document_type public.identity_document_type not null,
  identity_document_number text not null,
  user_code text not null,
  password_hash text not null,
  email_code_hash text,
  email_code_expires_at timestamptz,
  email_code_sent_at timestamptz,
  email_code_send_count integer not null default 0,
  email_code_failed_attempts integer not null default 0,
  email_verified_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  constraint student_registrations_given_names_not_blank check (btrim(given_names) <> ''),
  constraint student_registrations_family_names_not_blank check (btrim(family_names) <> ''),
  constraint student_registrations_email_not_blank check (btrim(email) <> ''),
  constraint student_registrations_phone_not_blank check (btrim(phone) <> ''),
  constraint student_registrations_document_not_blank check (btrim(identity_document_number) <> ''),
  constraint student_registrations_user_code_not_blank check (btrim(user_code) <> ''),
  constraint student_registrations_send_count_nonnegative check (email_code_send_count >= 0),
  constraint student_registrations_failed_attempts_nonnegative check (email_code_failed_attempts >= 0)
);

comment on table public.student_registrations is
  'Student sign-up data waiting for payment. Rows are deleted when the account is activated or 24 hours after creation.';

create unique index student_registrations_email_unique_ci
  on public.student_registrations (lower(btrim(email)));
create unique index student_registrations_user_code_unique_ci
  on public.student_registrations (lower(btrim(user_code)));
create index student_registrations_college_id_idx
  on public.student_registrations (college_id);
create index student_registrations_expires_at_idx
  on public.student_registrations (expires_at);

alter table public.student_registrations enable row level security;
revoke all on table public.student_registrations from public, anon, authenticated;
grant select, insert, update, delete on table public.student_registrations to service_role;

-- Un código reservado por un registro pendiente no puede usarse en otro perfil
-- mientras el registro siga vigente, para que el pago nunca termine sin cuenta.
create or replace function private.profiles_reject_reserved_user_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.student_registrations r
    where lower(btrim(r.user_code)) = lower(btrim(new.user_code))
      and r.expires_at > now()
  ) then
    raise exception 'user_code_reserved'
      using errcode = '23505',
        detail = 'The user code is reserved by a pending student registration.';
  end if;
  return new;
end;
$$;

create trigger profiles_reject_reserved_user_code
  before insert or update of user_code
  on public.profiles
  for each row execute function private.profiles_reject_reserved_user_code();

-- Colegios que puede elegir quien se registra. Si no hay ninguno activo, crea
-- "Chancón – Particular" una sola vez.
create or replace function public.edge_registration_colleges()
returns table (college_id uuid, college_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.colleges c where c.is_active) then
    insert into public.colleges (code, name, description)
    values (
      'CHANCON-PARTICULAR',
      'Chancón – Particular',
      'Colegio por defecto para estudiantes que se registran por su cuenta.'
    )
    on conflict ((lower(btrim(code)))) do update set is_active = true;
  end if;

  return query
    select c.id, c.name
    from public.colleges c
    where c.is_active
    order by c.name;
end;
$$;

-- Devuelve cuáles de los códigos dados ya están en uso o reservados. Cada
-- código se busca por igualdad en los índices únicos, sin recorrer la tabla.
create or replace function public.edge_taken_user_codes(p_codes text[])
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select candidate
  from unnest(p_codes) as candidate
  where exists (
      select 1 from public.profiles p
      where lower(btrim(p.user_code)) = lower(btrim(candidate))
    )
    or exists (
      select 1 from public.student_registrations r
      where lower(btrim(r.user_code)) = lower(btrim(candidate))
        and r.expires_at > now()
    );
$$;

-- Crea el registro pendiente. Un registro anterior con el mismo correo se
-- reemplaza: es la misma persona volviendo a empezar.
create or replace function public.edge_create_student_registration(
  p_college_id uuid,
  p_given_names text,
  p_family_names text,
  p_email text,
  p_phone text,
  p_identity_document_type public.identity_document_type,
  p_identity_document_number text,
  p_user_code text,
  p_password_hash text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  violated_index text;
begin
  delete from public.student_registrations r where r.expires_at <= now();
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

  if exists (
    select 1 from public.edge_taken_user_codes(array[p_user_code])
  ) then
    raise exception 'user_code_taken';
  end if;

  insert into public.student_registrations (
    college_id, given_names, family_names, email, phone,
    identity_document_type, identity_document_number, user_code, password_hash
  )
  values (
    p_college_id, btrim(p_given_names), btrim(p_family_names), lower(btrim(p_email)),
    btrim(p_phone), p_identity_document_type, btrim(p_identity_document_number),
    btrim(p_user_code), p_password_hash
  )
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    -- Dos registros simultáneos con el mismo correo o el mismo código.
    get stacked diagnostics violated_index = constraint_name;
    if violated_index = 'student_registrations_email_unique_ci' then
      raise exception 'registration_conflict';
    end if;
    raise exception 'user_code_taken';
end;
$$;

-- Convierte un registro verificado en perfil de estudiante. La cuenta de
-- auth.users la crea antes la Edge Function con el mismo id.
create or replace function public.edge_activate_student_registration(
  p_registration_id uuid,
  p_user_id uuid,
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

  -- Se borra primero para liberar la reserva del código antes de insertar.
  delete from public.student_registrations r where r.id = registration.id;

  insert into public.profiles (
    id, college_id, role, user_code, full_name, given_names, family_names,
    email, phone, identity_document_type, identity_document_number,
    is_active, access_valid_from, access_valid_until
  )
  values (
    p_user_id, registration.college_id, 'student', registration.user_code,
    registration.given_names || ' ' || registration.family_names,
    registration.given_names, registration.family_names, registration.email,
    registration.phone, registration.identity_document_type,
    registration.identity_document_number, true, p_access_valid_from,
    p_access_valid_until
  );

  return p_user_id;
end;
$$;

revoke all on function public.edge_registration_colleges() from public, anon, authenticated;
revoke all on function public.edge_taken_user_codes(text[]) from public, anon, authenticated;
revoke all on function public.edge_create_student_registration(
  uuid, text, text, text, text, public.identity_document_type, text, text, text
) from public, anon, authenticated;
revoke all on function public.edge_activate_student_registration(uuid, uuid, date, date)
  from public, anon, authenticated;

grant execute on function public.edge_registration_colleges() to service_role;
grant execute on function public.edge_taken_user_codes(text[]) to service_role;
grant execute on function public.edge_create_student_registration(
  uuid, text, text, text, text, public.identity_document_type, text, text, text
) to service_role;
grant execute on function public.edge_activate_student_registration(uuid, uuid, date, date)
  to service_role;

-- Los registros abandonados (sin pago) se borran a las 24 horas.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule(
  'purge-expired-student-registrations',
  '17 * * * *',
  $$delete from public.student_registrations where expires_at <= now()$$
);
