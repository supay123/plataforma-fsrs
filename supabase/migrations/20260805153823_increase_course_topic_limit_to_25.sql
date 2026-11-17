create or replace function public.validate_topic_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_count integer;
begin
  if new.status <> 'archived'::public.topic_status then
    select count(*) into current_count
    from public.topics
    where course_id = new.course_id
      and status <> 'archived'::public.topic_status
      and id <> new.id;

    if current_count >= 25 then
      raise exception 'A course can have at most 25 non-archived topics';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.validate_topic_limit() is
  'Enforces a maximum of 25 non-archived topics per course.';
