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
-- Protección del profesor demo: dueño del banco de pruebas. Si se borrara, el
-- modo gratuito se quedaría sin grupo. El trigger sobre profiles también frena
-- el borrado en cascada desde auth.users. El id debe coincidir con DEMO_TEACHER_ID
-- de _shared/free-mode.ts.
-- ---------------------------------------------------------------------------
create function private.protect_demo_teacher()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.id = '5c1f4a9e-7d2b-4c3a-9e68-0d1c4a5b7e01'::uuid then
    raise exception 'demo_teacher_protected'
      using errcode = 'P0001',
        detail = 'The demo teacher owns the free mode question bank and cannot be deleted.';
  end if;
  return old;
end;
$$;

create trigger profiles_protect_demo_teacher
  before delete on public.profiles
  for each row execute function private.protect_demo_teacher();

-- ---------------------------------------------------------------------------
-- Siembra: institución demo con un grupo, un curso y un tema de ejemplo
-- ---------------------------------------------------------------------------
insert into public.colleges (code, name, description)
values (
  'CHANCON-DEMO',
  'Chancón – Modo gratuito',
  'Institución de pruebas que alimenta el modo gratuito del sitio. No se puede eliminar.'
)
on conflict ((lower(btrim(code)))) do nothing;

do $$
declare
  demo_college_id uuid;
  demo_teacher_id uuid;
  demo_course_id uuid;
  demo_topic_id uuid;
begin
  select id into demo_college_id
  from public.colleges
  where lower(btrim(code)) = 'chancon-demo';

  demo_teacher_id := '5c1f4a9e-7d2b-4c3a-9e68-0d1c4a5b7e01';

  if not exists (select 1 from public.profiles where id = demo_teacher_id) then
    -- Mismo formato de correo opaco que usa admin-create-user. Sin contraseña:
    -- nadie inicia sesión con esta cuenta, solo es dueña del banco de pruebas.
    insert into auth.users (
      instance_id, id, aud, role, email, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000', demo_teacher_id,
      'authenticated', 'authenticated',
      demo_teacher_id::text || '@users.fsrs.local', now(),
      '{"provider":"email","providers":["email"],"role":"teacher"}'::jsonb,
      '{}'::jsonb, now(), now()
    );
    insert into public.profiles (id, college_id, role, user_code, full_name)
    values (
      demo_teacher_id, demo_college_id, 'teacher',
      'chancon-demo-profesor', 'Grupo de prueba Chancón'
    );
  end if;

  select id into demo_course_id
  from public.courses
  where college_id = demo_college_id
    and teacher_id = demo_teacher_id
    and name = 'Matemática básica';

  if demo_course_id is null then
    insert into public.courses (college_id, teacher_id, name, description, created_by)
    values (
      demo_college_id, demo_teacher_id, 'Matemática básica',
      'Curso de ejemplo del modo gratuito.', demo_teacher_id
    )
    returning id into demo_course_id;
  end if;

  select id into demo_topic_id
  from public.topics
  where course_id = demo_course_id and name = 'Operaciones y fracciones';

  if demo_topic_id is null then
    insert into public.topics (course_id, name, description, position, status, created_by)
    values (
      demo_course_id, 'Operaciones y fracciones',
      'Doce preguntas de ejemplo para probar Chancón.', 1, 'active', demo_teacher_id
    )
    returning id into demo_topic_id;

    insert into public.questions (
      topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, status, created_by
    )
    select demo_topic_id, q.statement, q.option_a, q.option_b, q.option_c,
      q.option_d, q.correct_option, q.explanation, 'active', demo_teacher_id
    from (values
      ('¿Cuánto es 7 × 8?', '54', '56', '48', '64', 'B', '7 × 8 = 56.'),
      ('¿Cuál es el resultado de 3/4 + 1/4?', '1', '4/8', '3/16', '1/2', 'A', 'Las fracciones tienen el mismo denominador: (3 + 1)/4 = 4/4 = 1.'),
      ('¿Cuánto es 15 − 27?', '12', '−12', '−42', '42', 'B', 'Como 27 es mayor que 15, el resultado es negativo: 15 − 27 = −12.'),
      ('¿Cuál es el 20 % de 150?', '20', '25', '30', '35', 'C', '20 % de 150 = 150 × 0,20 = 30.'),
      ('¿Cuánto es 2³ + 3²?', '13', '15', '17', '19', 'C', '2³ = 8 y 3² = 9, entonces 8 + 9 = 17.'),
      ('Si x + 9 = 21, ¿cuánto vale x?', '10', '11', '12', '30', 'C', 'Se resta 9 a ambos lados: x = 21 − 9 = 12.'),
      ('¿Cuál de estas fracciones es equivalente a 2/3?', '4/6', '3/4', '2/6', '6/4', 'A', 'Al multiplicar numerador y denominador por 2 se obtiene 4/6.'),
      ('¿Cuánto es 144 ÷ 12?', '10', '11', '12', '14', 'C', '12 × 12 = 144.'),
      ('¿Cuál es el mínimo común múltiplo de 4 y 6?', '8', '10', '12', '24', 'C', 'Los múltiplos de 4 son 4, 8, 12… y los de 6 son 6, 12…; el primero común es 12.'),
      ('Un artículo cuesta S/ 80 y tiene 25 % de descuento. ¿Cuánto se paga?', 'S/ 55', 'S/ 60', 'S/ 65', 'S/ 70', 'B', 'El descuento es 80 × 0,25 = 20, entonces se paga 80 − 20 = S/ 60.'),
      ('¿Cuánto es 0,5 × 0,4?', '0,02', '0,2', '2', '0,9', 'B', '5 × 4 = 20 y hay dos decimales en total: 0,20 = 0,2.'),
      ('¿Cuál es el perímetro de un cuadrado de lado 9 cm?', '18 cm', '27 cm', '36 cm', '81 cm', 'C', 'El perímetro es 4 × 9 = 36 cm.')
    ) as q(statement, option_a, option_b, option_c, option_d, correct_option, explanation);
  end if;
end;
$$;

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
