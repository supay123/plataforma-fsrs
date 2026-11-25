-- Los registros pendientes de pago duran 7 días (antes 24 horas). Los ya
-- creados conservan su vencimiento; solo cambia el de los nuevos.
alter table public.student_registrations
  alter column expires_at set default (now() + interval '7 days');

-- Un registro con un QR de los últimos 7 días no se borra: si el pago llega
-- tarde, todavía hay a quién activar.
select cron.schedule(
  'purge-expired-student-registrations',
  '17 * * * *',
  $$
    delete from public.student_registrations r
    where r.expires_at <= now()
      and not exists (
        select 1 from public.plan_payments p
        where p.registration_id = r.id and p.created_at > now() - interval '7 days'
      )
  $$
);
