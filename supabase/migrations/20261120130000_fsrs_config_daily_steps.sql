-- Primer acierto: repaso a 1 día; primer fallo: 12 h; fallo de una pregunta ya aprendida: 1 día.
-- Tope real de 45 días: ts-fsrs suma 1 día después de aplicar maximum_interval, por eso el parámetro es 44.
-- Las sesiones ya iniciadas conservan la configuración con la que empezaron.
update public.fsrs_configs set is_active = false where is_active;

insert into public.fsrs_configs (
  name,
  library_name,
  library_version,
  parameters,
  rating_mapping,
  is_active,
  locked_at
)
values (
  'FSRS v6 pasos diarios, máximo 45 días',
  'ts-fsrs',
  '5.4.1',
  '{"learning_steps":["12h","1d"],"relearning_steps":["1d"],"maximum_interval":44}'::jsonb,
  '{"correct":"Good","incorrect":"Again"}'::jsonb,
  true,
  now()
);
