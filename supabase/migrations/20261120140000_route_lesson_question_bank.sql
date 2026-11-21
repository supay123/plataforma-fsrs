-- Modo ruta: cada lección tiene un banco de preguntas (hasta 100) y en cada
-- intento se muestran `questions_to_show` elegidas al azar. Las lecciones
-- anteriores tenían exactamente 5 preguntas y se mostraban todas, así que
-- `questions_to_show` arranca en 5.

alter table public.route_lessons
  add column questions_to_show smallint not null default 5,
  add constraint route_lessons_questions_to_show_range
    check (questions_to_show between 1 and 100);

comment on column public.route_lessons.questions_to_show is
  'Cuántas preguntas del banco de la lección ve el estudiante en cada intento (al azar). Nunca supera el total de preguntas.';

-- La lección se crea primero con su nombre; el texto llega después con su JSON.
alter table public.route_lessons
  drop constraint route_lessons_content_not_blank;

alter table public.route_questions
  drop constraint route_questions_position_range,
  add constraint route_questions_position_range check (position between 1 and 100);

comment on table public.route_questions is
  'Banco de preguntas de una lección de ruta (de 1 a 100). Independientes de questions y del repaso FSRS.';

comment on table public.route_lessons is
  'Lecciones de un tema de ruta. content_text admite saltos de línea y KaTeX. is_ready pasa a true al guardar su banco de preguntas; solo las lecciones listas las ven los estudiantes.';
