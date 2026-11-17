-- Perfil del estudiante autorregistrado: cambio de correo verificado con un
-- código y restablecimiento de contraseña con un link enviado al correo.
--
-- Todo es aditivo. Como en el registro, de cada código solo se guarda su hash
-- y la fila se borra cuando el código se usa; las vencidas las borra un cron.

-- Links para restablecer la contraseña. Una fila por link; al pedir uno nuevo
-- se borran los anteriores del mismo usuario.
create table public.password_reset_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint password_reset_codes_hash_not_blank check (btrim(code_hash) <> '')
);

comment on table public.password_reset_codes is
  'Password reset links sent by email. Only the SHA-256 of the code is stored; the row is deleted when the code is used or after it expires.';

create index password_reset_codes_user_id_idx on public.password_reset_codes (user_id);
create index password_reset_codes_expires_at_idx on public.password_reset_codes (expires_at);

alter table public.password_reset_codes enable row level security;

-- Cambio de correo pendiente de verificar. Una fila por usuario; se borra al
-- confirmar el código o 24 horas después de creada.
create table public.email_change_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  new_email text not null,
  code_hash text not null,
  code_expires_at timestamptz not null,
  code_sent_at timestamptz not null,
  send_count integer not null default 1,
  failed_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  constraint email_change_requests_email_not_blank check (btrim(new_email) <> ''),
  constraint email_change_requests_send_count_positive check (send_count > 0),
  constraint email_change_requests_failed_attempts_nonnegative check (failed_attempts >= 0)
);

comment on table public.email_change_requests is
  'Email changes waiting for the code sent to the new address. Deleted when confirmed or 24 hours after creation.';

create index email_change_requests_created_at_idx on public.email_change_requests (created_at);

alter table public.email_change_requests enable row level security;

-- Indica si un correo ya pertenece a una cuenta o a un registro verificado.
-- p_except_user_id excluye al propio usuario cuando cambia su correo.
create function public.edge_email_in_use(p_email text, p_except_user_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where lower(btrim(p.email)) = lower(btrim(p_email))
      and p.id is distinct from p_except_user_id
  ) or exists (
    select 1 from auth.users u
    where lower(u.email) = lower(btrim(p_email))
      and u.id is distinct from p_except_user_id
  ) or exists (
    select 1 from public.student_registrations r
    where lower(btrim(r.email)) = lower(btrim(p_email))
      and r.email_verified_at is not null
      and r.expires_at > now()
  );
$$;

-- Cierra todas las sesiones de un usuario (solo de ese usuario). Los refresh
-- tokens se borran en cascada con sus sesiones.
create function public.edge_revoke_user_sessions(p_user_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from auth.sessions s where s.user_id = p_user_id;
$$;

revoke all on function public.edge_email_in_use(text, uuid) from public, anon, authenticated;
revoke all on function public.edge_revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.edge_email_in_use(text, uuid) to service_role;
grant execute on function public.edge_revoke_user_sessions(uuid) to service_role;

select cron.schedule(
  'purge-expired-account-codes',
  '23 * * * *',
  $$
    delete from public.password_reset_codes where expires_at <= now();
    delete from public.email_change_requests where created_at <= now() - interval '24 hours';
  $$
);
