-- PostgreSQL requires a newly-added enum value to be committed before it can
-- be referenced from stored routines created by a later migration.
alter type public.question_selection_reason
  add value if not exists 'scheduled' after 'new';
