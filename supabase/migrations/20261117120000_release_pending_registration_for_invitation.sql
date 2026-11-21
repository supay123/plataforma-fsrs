-- Cuando un administrador invita a un correo que tiene un registro pendiente
-- (la persona empezó a registrarse y no pagó), la invitación gana: el registro
-- se borra, igual que cuando la misma persona vuelve a registrarse. No se borra
-- si ya tiene un pago aprobado sin aplicar, para no dejar un pago sin cuenta.
create function public.edge_release_pending_registration(p_email text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.student_registrations r
  where lower(btrim(r.email)) = lower(btrim(p_email))
    and not exists (
      select 1 from public.plan_payments p
      where p.registration_id = r.id
        and p.status = 'succeeded'
        and p.applied_at is null
    );
$$;

revoke all on function public.edge_release_pending_registration(text)
  from public, anon, authenticated;
grant execute on function public.edge_release_pending_registration(text) to service_role;
