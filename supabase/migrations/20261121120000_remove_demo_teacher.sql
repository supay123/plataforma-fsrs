-- El modo gratuito ya no siembra un profesor demo: los profesores de la
-- institución demo los crea el admin (su nombre es el del grupo). Esta
-- migración limpia las bases donde la siembra anterior ya se había ejecutado;
-- borrar el usuario arrastra en cascada su perfil, curso, tema y preguntas.
delete from auth.users
where id = '5c1f4a9e-7d2b-4c3a-9e68-0d1c4a5b7e01';
