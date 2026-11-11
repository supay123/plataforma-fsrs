-- Pagos de planes con Kuti. Cada fila es un cobro creado en Kuti (QR y, si el
-- monto lo permite, código de pago de servicios); el monto lo fija el servidor
-- según el plan, nunca el navegador. Las Edge Functions los crean y aplican
-- con service_role; el administrador solo los consulta para revisar pagos que
-- no se pudieron aplicar.

create table public.plan_payments (
  id uuid primary key,
  kuti_payment_intent_id text not null,
  livemode boolean not null,
  plan text not null,
  amount numeric(10, 2) not null,
  -- Dueño del pago: el registro que se activa con él o el estudiante que
  -- renueva. Si se borran, queda en null y el correo permite ubicar el pago.
  registration_id uuid references public.student_registrations (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  email text,
  status text not null default 'pending',
  qr_payload text not null,
  -- Código de pago de servicios (banca o Yape servicios, institución KUTI).
  bank_code text,
  checkout_url text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  -- Cuándo se aplicó el pago y qué días de acceso cubrió.
  applied_at timestamptz,
  period_start date,
  period_end date,
  -- El administrador marca como resuelto un pago que no se pudo aplicar.
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint plan_payments_kuti_payment_intent_id_unique unique (kuti_payment_intent_id),
  constraint plan_payments_plan_valid check (plan in ('mensual', 'semestral')),
  constraint plan_payments_amount_positive check (amount > 0),
  constraint plan_payments_status_valid
    check (status in ('pending', 'succeeded', 'failed', 'expired', 'cancelled')),
  constraint plan_payments_paid_complete check ((status = 'succeeded') = (paid_at is not null)),
  constraint plan_payments_applied_complete
    check ((applied_at is null) = (period_start is null) and (period_start is null) = (period_end is null)),
  constraint plan_payments_applied_paid check (applied_at is null or paid_at is not null)
);

comment on table public.plan_payments is
  'Kuti charges for student plans, kept as payment history. A succeeded row without applied_at was paid but not applied yet; without owner it needs an administrator.';

create index plan_payments_registration_id_idx on public.plan_payments (registration_id);
create index plan_payments_profile_id_idx on public.plan_payments (profile_id);
create index plan_payments_needs_review_idx on public.plan_payments (paid_at)
  where status = 'succeeded' and applied_at is null and resolved_at is null;

alter table public.plan_payments enable row level security;
revoke all on table public.plan_payments from public, anon, authenticated;
grant select, insert, update, delete on table public.plan_payments to service_role;
grant select on table public.plan_payments to authenticated;
grant update (resolved_at) on table public.plan_payments to authenticated;

create policy plan_payments_admin_select on public.plan_payments
  for select to authenticated
  using ((select private.is_admin()));

create policy plan_payments_admin_resolve on public.plan_payments
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- La activación ahora nace de un pago: crea el perfil y marca el pago como
-- aplicado en la misma transacción, así un aviso repetido nunca activa dos
-- veces.
drop function public.edge_activate_student_registration(uuid, uuid, text, date, date);

create function public.edge_activate_student_registration(
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

  update public.plan_payments p
  set profile_id = p_user_id,
    applied_at = now(),
    period_start = p_access_valid_from,
    period_end = p_access_valid_until
  where p.id = payment.id;

  return p_user_id;
end;
$$;

-- Renovación: si el plan sigue vigente, los meses pagados se suman al final;
-- si ya venció, el acceso vuelve a empezar el día del pago.
create function public.edge_apply_renewal_payment(p_payment_id uuid, p_months integer)
returns table (period_start date, period_end date)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  payment public.plan_payments%rowtype;
  student public.profiles%rowtype;
  paid_day date;
  new_start date;
  new_end date;
begin
  if p_months is null or p_months < 1 then
    raise exception 'invalid_months';
  end if;

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

  select * into student
  from public.profiles s
  where s.id = payment.profile_id and s.role = 'student'
  for update;

  if student.id is null then
    raise exception 'student_not_found';
  end if;

  paid_day := (payment.paid_at at time zone 'America/Lima')::date;
  new_start := greatest(coalesce(student.access_valid_until + 1, paid_day), paid_day);
  new_end := (new_start + make_interval(months => p_months))::date - 1;

  update public.profiles s
  set access_valid_from = case
      when s.access_valid_from is null or s.access_valid_until < paid_day then new_start
      else s.access_valid_from
    end,
    access_valid_until = new_end
  where s.id = student.id;

  update public.plan_payments p
  set applied_at = now(),
    period_start = new_start,
    period_end = new_end
  where p.id = payment.id;

  return query select new_start, new_end;
end;
$$;

revoke all on function public.edge_activate_student_registration(uuid, uuid, text, date, date)
  from public, anon, authenticated;
revoke all on function public.edge_apply_renewal_payment(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.edge_activate_student_registration(uuid, uuid, text, date, date)
  to service_role;
grant execute on function public.edge_apply_renewal_payment(uuid, integer) to service_role;

-- Un registro con un QR de las últimas 24 horas no se borra: si el pago llega
-- tarde, todavía hay a quién activar.
select cron.schedule(
  'purge-expired-student-registrations',
  '17 * * * *',
  $$
    delete from public.student_registrations r
    where r.expires_at <= now()
      and not exists (
        select 1 from public.plan_payments p
        where p.registration_id = r.id and p.created_at > now() - interval '24 hours'
      )
  $$
);

-- Secreto con el que Kuti firma sus avisos (uno por modo: test o live). Se
-- guarda cifrado en Vault al registrar el webhook, sin variables de entorno.
create function public.edge_kuti_webhook_secret(p_mode text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from vault.decrypted_secrets s
  where s.name = 'kuti_webhook_secret_' || p_mode;
$$;

create function public.edge_save_kuti_webhook_secret(p_mode text, p_secret text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  secret_name text := 'kuti_webhook_secret_' || p_mode;
  secret_id uuid;
begin
  if p_mode not in ('test', 'live') then
    raise exception 'invalid_mode';
  end if;

  select s.id into secret_id from vault.secrets s where s.name = secret_name;
  if secret_id is null then
    perform vault.create_secret(p_secret, secret_name, 'Kuti webhook signing secret');
  else
    perform vault.update_secret(secret_id, p_secret);
  end if;
end;
$$;

revoke all on function public.edge_kuti_webhook_secret(text) from public, anon, authenticated;
revoke all on function public.edge_save_kuti_webhook_secret(text, text) from public, anon, authenticated;
grant execute on function public.edge_kuti_webhook_secret(text) to service_role;
grant execute on function public.edge_save_kuti_webhook_secret(text, text) to service_role;
