-- Ranking por institución y grupo (profesor).
--
-- Cada institución configura (1 a 1 con colleges) si el ranking está activado
-- (por defecto NO) y qué categorías muestra. Cada usuario que consulta el
-- ranking tiene una caché por categoría con el ranking completo de su grupo
-- (snapshot), para que la paginación no vea posiciones cambiantes. La caché
-- vive 1 hora desde la última consulta (vida deslizante).

create type public.ranking_type as enum ('NIVEL', 'MEDALLAS', 'NOTA');

create table public.college_ranking_settings (
  college_id uuid primary key references public.colleges(id) on delete cascade,
  enabled boolean not null default false,
  categories public.ranking_type[] not null
    default array['NIVEL', 'MEDALLAS', 'NOTA']::public.ranking_type[],
  updated_at timestamptz not null default now(),
  constraint college_ranking_settings_categories_not_empty check (
    cardinality(categories) >= 1
    and array_position(categories, null) is null
  )
);

comment on table public.college_ranking_settings is
  'Ranking configuration of a college (1 to 1): enabled flag (off by default) and the categories it shows. Created with the college.';

create table public.cache_ranking (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ranking_type public.ranking_type not null,
  entries jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (user_id, ranking_type)
);

comment on table public.cache_ranking is
  'Snapshot of the complete ranking of a user''s group, one row per (user, ranking type). Only service_role reads it; each endpoint serves a user their own row. expires_at slides one hour forward on every read.';

create index cache_ranking_expires_at_idx on public.cache_ranking (expires_at);

create trigger college_ranking_settings_set_updated_at
  before update on public.college_ranking_settings
  for each row execute function public.set_updated_at();

alter table public.college_ranking_settings enable row level security;
alter table public.cache_ranking enable row level security;

create policy college_ranking_settings_select on public.college_ranking_settings
  for select to authenticated
  using (
    (select private.is_admin())
    or college_id = (select private.current_college_id())
  );
create policy college_ranking_settings_insert on public.college_ranking_settings
  for insert to authenticated
  with check ((select private.is_admin()));
create policy college_ranking_settings_update on public.college_ranking_settings
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Sin políticas: la caché solo la toca service_role desde las Edge Functions.
revoke all on public.cache_ranking from anon, authenticated;

create function private.create_college_ranking_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.college_ranking_settings (college_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger colleges_create_ranking_settings
  after insert on public.colleges
  for each row execute function private.create_college_ranking_settings();

insert into public.college_ranking_settings (college_id)
select id from public.colleges
on conflict do nothing;

-- Borra las cachés vencidas; devuelve cuántas. La llama el cron y, de forma
-- oportunista, el endpoint que renueva la caché.
create function public.edge_purge_expired_ranking_cache()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  purged integer;
begin
  delete from public.cache_ranking where expires_at <= now();
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke all on function public.edge_purge_expired_ranking_cache()
  from public, anon, authenticated;
grant execute on function public.edge_purge_expired_ranking_cache()
  to service_role;

select cron.schedule(
  'purge-expired-ranking-cache',
  '*/15 * * * *',
  $$select public.edge_purge_expired_ranking_cache()$$
);
