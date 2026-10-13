-- Invitaciones de estudiantes. El administrador indica correo, institución y
-- periodo de acceso; el estudiante recibe un link para completar sus datos y
-- crear su cuenta. Todo es aditivo.
--
-- Como los demás códigos, del link solo se guarda su hash y la fila se borra
-- al aceptarse. Las vencidas se conservan para poder reenviarlas y se borran
-- 30 días después de vencer.

create table public.student_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  college_id uuid not null references public.colleges (id) on delete cascade,
  access_valid_from date not null,
  access_valid_until date not null,
  code_hash text not null,
  expires_at timestamptz not null,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint student_invitations_email_not_blank check (btrim(email) <> ''),
  constraint student_invitations_dates_ordered check (access_valid_from <= access_valid_until)
);

comment on table public.student_invitations is
  'Student invitations sent by an administrator. Only the SHA-256 of the link code is stored; the row is deleted when accepted, cancelled, or 30 days after it expires.';

-- Una invitación por correo: invitar de nuevo reemplaza la anterior.
create unique index student_invitations_email_unique_ci
  on public.student_invitations (lower(btrim(email)));
create unique index student_invitations_code_hash_unique
  on public.student_invitations (code_hash);
create index student_invitations_college_id_idx on public.student_invitations (college_id);
create index student_invitations_invited_by_idx on public.student_invitations (invited_by);
create index student_invitations_expires_at_idx on public.student_invitations (expires_at);

alter table public.student_invitations enable row level security;

select cron.schedule(
  'purge-expired-student-invitations',
  '29 * * * *',
  $$delete from public.student_invitations where expires_at <= now() - interval '30 days'$$
);
