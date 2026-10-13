-- Numeración correlativa de las hojas del Libro de Reclamaciones virtual.
-- Solo se guarda el último número entregado: los reclamos se envían por correo
-- y no se almacenan en la base de datos.
create sequence private.complaint_sheet_number_seq
  as bigint
  start with 1
  increment by 1
  no cycle;

revoke all on sequence private.complaint_sheet_number_seq
  from public, anon, authenticated;

-- service_role no tiene USAGE sobre el esquema private, por eso la función se
-- ejecuta con los permisos de su dueño y solo expone el siguiente número.
create or replace function public.edge_next_complaint_sheet_number()
returns bigint
language sql
volatile
security definer
set search_path = ''
as $$
  select nextval('private.complaint_sheet_number_seq');
$$;

comment on function public.edge_next_complaint_sheet_number() is
  'Returns the next correlative number for a Libro de Reclamaciones sheet.';

revoke all on function public.edge_next_complaint_sheet_number()
  from public, anon, authenticated;
grant execute on function public.edge_next_complaint_sheet_number()
  to service_role;
