-- Mercado Pago reemplaza a Kuti. Se paga con Yape: el estudiante ingresa su
-- celular y el código de aprobación (OTP) de su app, el navegador lo convierte
-- en un token de un solo uso y el servidor crea el pago, que se aprueba o
-- rechaza en el acto. Ya no hay QR, código de pago de servicios ni
-- vencimiento. Los cobros de Kuti se conservan como historial.

alter table public.plan_payments
  rename column kuti_payment_intent_id to provider_payment_id;
alter table public.plan_payments
  drop constraint plan_payments_kuti_payment_intent_id_unique;

-- La fila se crea antes de llamar a Mercado Pago (su id viaja como referencia
-- externa), así un pago aprobado nunca queda sin registro. El id del proveedor
-- llega después.
alter table public.plan_payments
  alter column provider_payment_id drop not null,
  add column provider text not null default 'kuti',
  -- Motivo que da Mercado Pago, por ejemplo al rechazar un pago.
  add column status_detail text;
alter table public.plan_payments
  alter column provider set default 'mercadopago',
  add constraint plan_payments_provider_valid check (provider in ('kuti', 'mercadopago')),
  add constraint plan_payments_provider_payment_id_unique unique (provider, provider_payment_id),
  drop column qr_payload,
  drop column bank_code,
  drop column checkout_url,
  drop column expires_at;

comment on table public.plan_payments is
  'Student plan payments (Mercado Pago; older rows from Kuti), kept as payment history. A succeeded row without applied_at was paid but not applied yet; without owner it needs an administrator.';

-- El webhook de Kuti ya no existe.
drop function public.edge_kuti_webhook_secret(text);
drop function public.edge_save_kuti_webhook_secret(text, text);
delete from vault.secrets where name like 'kuti_webhook_secret_%';

-- Clave secreta con la que Mercado Pago firma sus avisos. Se copia del panel
-- (Tus integraciones → Webhooks) y se guarda cifrada en Vault desde el editor
-- SQL, sin variables de entorno:
--   select vault.create_secret('<clave>', 'mercadopago_webhook_secret');
create function public.edge_mercadopago_webhook_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from vault.decrypted_secrets s
  where s.name = 'mercadopago_webhook_secret';
$$;

revoke all on function public.edge_mercadopago_webhook_secret() from public, anon, authenticated;
grant execute on function public.edge_mercadopago_webhook_secret() to service_role;
