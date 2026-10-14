-- Hojas del Libro de Reclamaciones reservadas por cada IP, para limitar los
-- envíos del formulario público. Los reclamos siguen sin guardarse: solo queda
-- el hash de la IP y el número entregado, y las filas se borran al día siguiente.
create table private.complaint_sheet_requests (
  sheet_number bigint primary key,
  ip_hash text not null,
  requested_on date not null,
  created_at timestamptz not null default now(),
  -- null mientras el correo no se envía; un reintento reutiliza el número.
  sent_at timestamptz
);

create index complaint_sheet_requests_ip_day_idx
  on private.complaint_sheet_requests (ip_hash, requested_on);

revoke all on table private.complaint_sheet_requests
  from public, anon, authenticated;

-- Entrega el número de una hoja nueva, o el de una reservada por la misma IP
-- cuyo envío falló (p_retry_sheet_number), para no dejar huecos en la
-- numeración. Falla con 'complaint_daily_limit' si la IP ya pidió
-- p_daily_limit hojas hoy (hora de Lima).
create or replace function public.edge_reserve_complaint_sheet(
  p_ip_hash text,
  p_daily_limit integer,
  p_retry_sheet_number bigint default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Lima')::date;
  reserved private.complaint_sheet_requests%rowtype;
begin
  -- Dos envíos simultáneos de la misma IP no pueden saltarse el límite.
  perform pg_advisory_xact_lock(hashtext('complaint_sheet:' || p_ip_hash));

  delete from private.complaint_sheet_requests
  where requested_on < today - 1;

  if p_retry_sheet_number is not null then
    select * into reserved
    from private.complaint_sheet_requests
    where sheet_number = p_retry_sheet_number
      and ip_hash = p_ip_hash
      and sent_at is null;
    if found then
      return jsonb_build_object(
        'sheet_number', reserved.sheet_number,
        'submitted_at', reserved.created_at
      );
    end if;
  end if;

  if (
    select count(*)
    from private.complaint_sheet_requests
    where ip_hash = p_ip_hash
      and requested_on = today
  ) >= p_daily_limit then
    raise exception 'complaint_daily_limit';
  end if;

  insert into private.complaint_sheet_requests (sheet_number, ip_hash, requested_on)
  values (nextval('private.complaint_sheet_number_seq'), p_ip_hash, today)
  returning * into reserved;

  return jsonb_build_object(
    'sheet_number', reserved.sheet_number,
    'submitted_at', reserved.created_at
  );
end;
$$;

create or replace function public.edge_mark_complaint_sheet_sent(
  p_sheet_number bigint
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update private.complaint_sheet_requests
  set sent_at = now()
  where sheet_number = p_sheet_number
    and sent_at is null;
$$;

revoke all on function public.edge_reserve_complaint_sheet(text, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.edge_reserve_complaint_sheet(text, integer, bigint)
  to service_role;

revoke all on function public.edge_mark_complaint_sheet_sent(bigint)
  from public, anon, authenticated;
grant execute on function public.edge_mark_complaint_sheet_sent(bigint)
  to service_role;

-- La función complaints reserva el número junto con el límite por IP; la que
-- solo entregaba el siguiente número ya no se usa.
drop function public.edge_next_complaint_sheet_number();
