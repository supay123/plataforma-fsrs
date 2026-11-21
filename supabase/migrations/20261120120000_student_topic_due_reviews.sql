-- Preguntas vencidas (due_at <= now()) por estudiante y tema: las mismas que FSRS
-- prioriza al armar una sesión. security_invoker mantiene la RLS de student_question_cards.
create or replace view public.v_student_topic_due_reviews
with (security_invoker = true) as
select
  card.student_id,
  t.course_id,
  c.name as course_name,
  t.id as topic_id,
  t.name as topic_name,
  count(*) as due_questions,
  min(card.due_at) as oldest_due_at
from public.student_question_cards card
join public.questions q on q.id = card.question_id and q.status = 'active'::public.question_status
join public.topics t on t.id = q.topic_id
join public.courses c on c.id = t.course_id
where card.due_at <= now()
group by card.student_id, t.course_id, c.name, t.id, t.name;

comment on view public.v_student_topic_due_reviews is
  'Active questions whose FSRS card is due, grouped by student and topic.';
