alter table public.profiles
  add column security_question text,
  add column security_answer_hash text,
  add column security_failed_attempts integer not null default 0,
  add column security_locked_until timestamptz,
  add constraint profiles_security_question_not_blank
    check (security_question is null or btrim(security_question) <> ''),
  add constraint profiles_security_recovery_complete
    check (
      (security_question is null and security_answer_hash is null)
      or (security_question is not null and security_answer_hash is not null)
    ),
  add constraint profiles_security_failed_attempts_nonnegative
    check (security_failed_attempts >= 0);

comment on column public.profiles.security_answer_hash is
  'PBKDF2 hash of the normalized recovery answer. The plaintext answer is never stored.';

-- The existing table-level SELECT grant would expose every future column through
-- the Data API. Replace it with a column grant so recovery hashes and lock state
-- remain server-only even for administrators.
revoke select on table public.profiles from authenticated;
grant select (
  id,
  college_id,
  role,
  user_code,
  full_name,
  is_active,
  access_valid_from,
  access_valid_until,
  created_by,
  created_at,
  updated_at,
  security_question
) on table public.profiles to authenticated;
