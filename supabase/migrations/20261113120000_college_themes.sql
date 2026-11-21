-- Tema (colores) de cada institución.
--
-- Cada institución puede guardar 4 colores por modo (claro y oscuro): primario,
-- secundario, fondo base y fondo de bloques. Sin filas, la institución usa los
-- colores por defecto de la aplicación (así funcionan las instituciones que ya
-- existían). Restablecer los colores = borrar sus filas.
-- La lectura pública sin sesión la hace la Edge Function `public` (GET /public/theme).

create table public.college_themes (
  college_id uuid not null references public.colleges(id) on delete cascade,
  mode text not null,
  primary_color text not null,
  secondary_color text not null,
  base_color text not null,
  blocks_color text not null,
  updated_at timestamptz not null default now(),
  primary key (college_id, mode),
  constraint college_themes_mode_valid check (mode in ('light', 'dark')),
  constraint college_themes_colors_hex check (
    primary_color ~ '^#[0-9a-f]{6}$'
    and secondary_color ~ '^#[0-9a-f]{6}$'
    and base_color ~ '^#[0-9a-f]{6}$'
    and blocks_color ~ '^#[0-9a-f]{6}$'
  )
);

comment on table public.college_themes is
  'Colors of a college per mode (light/dark), as #rrggbb in lowercase. No rows = default colors.';

create trigger college_themes_set_updated_at
  before update on public.college_themes
  for each row execute function public.set_updated_at();

alter table public.college_themes enable row level security;

create policy college_themes_select on public.college_themes
  for select to authenticated
  using ((select private.is_admin()));
create policy college_themes_insert on public.college_themes
  for insert to authenticated
  with check ((select private.is_admin()));
create policy college_themes_update on public.college_themes
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy college_themes_delete on public.college_themes
  for delete to authenticated
  using ((select private.is_admin()));
