-- Modo Gratuito: institución demo protegida, banco de preguntas de prueba y
-- límite de frecuencia para el registro de interesados (leads). Los leads no se
-- guardan en la base: solo van a un Google Sheet.
--
-- Las preguntas del modo gratuito salen de una institución propia (código
-- reservado CHANCON-DEMO) para no exponer los bancos de colegios reales. Esa
-- institución no puede borrarse ni cambiar de código: la Edge Function
-- `free-mode` la encuentra por ese código.

-- ---------------------------------------------------------------------------
-- Protección de la institución demo
-- ---------------------------------------------------------------------------
create function private.protect_demo_college()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if lower(btrim(old.code)) <> 'chancon-demo' then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'demo_college_protected'
      using errcode = 'P0001',
        detail = 'The demo college feeds the free mode and cannot be deleted.';
  end if;
  if lower(btrim(new.code)) <> 'chancon-demo' then
    raise exception 'demo_college_protected'
      using errcode = 'P0001',
        detail = 'The demo college code is reserved and cannot be changed.';
  end if;
  return new;
end;
$$;

create trigger colleges_protect_demo_delete
  before delete on public.colleges
  for each row execute function private.protect_demo_college();

create trigger colleges_protect_demo_code
  before update of code on public.colleges
  for each row execute function private.protect_demo_college();

-- ---------------------------------------------------------------------------
-- Siembra: institución demo (sin profesores: los crea el admin)
-- ---------------------------------------------------------------------------
insert into public.colleges (code, name, description)
values (
  'CHANCON-DEMO',
  'Chancón – Modo gratuito',
  'Institución de pruebas que alimenta el modo gratuito del sitio. No se puede eliminar.'
)
on conflict ((lower(btrim(code)))) do nothing;

-- ---------------------------------------------------------------------------
-- La institución demo no se ofrece en el registro de estudiantes
-- ---------------------------------------------------------------------------
create or replace function public.edge_registration_colleges()
returns table (college_id uuid, college_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.colleges c
    where c.is_active and lower(btrim(c.code)) <> 'chancon-demo'
  ) then
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
    where c.is_active and lower(btrim(c.code)) <> 'chancon-demo'
    order by c.name;
end;
$$;

create or replace function public.edge_registration_teachers()
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
    and lower(btrim(c.code)) <> 'chancon-demo'
    and exists (
      select 1 from public.courses co
      where co.teacher_id = p.id
        and co.status <> 'archived'::public.course_status
    )
  order by p.full_name
$$;

-- ---------------------------------------------------------------------------
-- Límite de frecuencia del registro de interesados
-- ---------------------------------------------------------------------------
-- Los interesados NO se guardan en la base (crecerían sin control): la Edge
-- Function `free-mode` los agrega a un Google Sheet. Aquí solo quedan hashes
-- SHA-256 de IP y correo para limitar el abuso, y se borran a las 24 horas.
-- Sin políticas y sin permisos para anon/authenticated: solo service_role.
create table public.lead_rate_limits (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  email_hash text not null,
  created_at timestamptz not null default now()
);

comment on table public.lead_rate_limits is
  'Attempts to register a free-mode lead, kept only as SHA-256 hashes of the ip and email to rate limit. Rows older than 24 hours are purged.';

create index lead_rate_limits_ip_hash_created_at_idx
  on public.lead_rate_limits (ip_hash, created_at);
create index lead_rate_limits_email_hash_created_at_idx
  on public.lead_rate_limits (email_hash, created_at);

alter table public.lead_rate_limits enable row level security;
revoke all on table public.lead_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.lead_rate_limits to service_role;

-- Comprueba los límites (5 por IP cada hora, 3 por correo cada día) y registra
-- el intento. Falla con 'lead_ip_limit' o 'lead_email_limit'.
create function public.edge_check_lead_rate_limit(
  p_ip_hash text,
  p_email_hash text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- Dos envíos simultáneos no pueden saltarse el límite.
  perform pg_advisory_xact_lock(hashtext('lead_ip:' || p_ip_hash));
  perform pg_advisory_xact_lock(hashtext('lead_email:' || p_email_hash));

  delete from public.lead_rate_limits where created_at < now() - interval '24 hours';

  if (
    select count(*) from public.lead_rate_limits l
    where l.ip_hash = p_ip_hash and l.created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'lead_ip_limit';
  end if;

  if (
    select count(*) from public.lead_rate_limits l
    where l.email_hash = p_email_hash and l.created_at > now() - interval '1 day'
  ) >= 3 then
    raise exception 'lead_email_limit';
  end if;

  insert into public.lead_rate_limits (ip_hash, email_hash)
  values (p_ip_hash, p_email_hash);
end;
$$;

revoke all on function public.edge_check_lead_rate_limit(text, text)
  from public, anon, authenticated;
grant execute on function public.edge_check_lead_rate_limit(text, text)
  to service_role;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule(
  'purge-lead-rate-limits',
  '37 * * * *',
  $$delete from public.lead_rate_limits where created_at < now() - interval '24 hours'$$
);

-- ID del Google Sheet donde se agregan los interesados. Se guarda cifrado en
-- Vault desde el editor SQL, sin variables de entorno:
--   select vault.create_secret('<ID de la hoja>', 'leads_sheet_id');
-- Sin el secreto devuelve null y el registro responde 503 leads_unavailable.
create function public.edge_leads_sheet_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from vault.decrypted_secrets s
  where s.name = 'leads_sheet_id';
$$;

revoke all on function public.edge_leads_sheet_id() from public, anon, authenticated;
grant execute on function public.edge_leads_sheet_id() to service_role;
