import "@supabase/functions-js/edge-runtime.d.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { getProgress, submitAttempt } from "./attempts.ts";
import {
  createLesson,
  deleteLesson,
  getLessonContent,
  listLessons,
  renameLesson,
  replaceLessonContent,
} from "./lessons.ts";
import {
  createCourse,
  deleteCourse,
  listCourses,
  updateCourse,
} from "./courses.ts";
import { createTopic, deleteTopic, listTopics, updateTopic } from "./topics.ts";

// Modo ruta: cursos de ruta (independientes de los de "Mi aprendizaje") con temas
// y lecciones que se desbloquean con 80% de acierto.
// Gestión (administrador y profesor dueño del curso o tema):
//   POST   /route-mode/courses             crea un curso de ruta
//   PUT    /route-mode/courses?id=         edita un curso
//   DELETE /route-mode/courses?id=         elimina un curso con sus temas
//   POST   /route-mode/topics              crea un tema dentro de un curso (route_course_id)
//   PUT    /route-mode/topics?id=          edita un tema
//   DELETE /route-mode/topics?id=          elimina un tema
//   POST   /route-mode/lessons             crea una lección con su nombre (aún sin contenido)
//   PUT    /route-mode/lessons?id=         cambia el nombre de la lección
//   PUT    /route-mode/lessons/content?id= guarda el JSON: texto y banco de preguntas
//   DELETE /route-mode/lessons?id=         elimina la lección
// Lectura (cada rol ve lo suyo):
//   GET    /route-mode/courses             cursos de ruta
//   GET    /route-mode/topics              temas (?route_course_id= filtra por curso)
//   GET    /route-mode/lessons?topic_id=   lecciones de un tema
//   GET    /route-mode/lessons/content?id= texto y preguntas (al estudiante, sorteadas y con respuestas cifradas en answer_key)
// Estudiante:
//   POST   /route-mode/attempts            envía un intento; califica y da xp
//   GET    /route-mode/progress            cursos, temas, lecciones y desbloqueos
export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "route-mode", {
          "POST /courses": createCourse,
          "PUT /courses": updateCourse,
          "DELETE /courses": deleteCourse,
          "GET /courses": listCourses,
          "POST /topics": createTopic,
          "PUT /topics": updateTopic,
          "DELETE /topics": deleteTopic,
          "GET /topics": listTopics,
          "POST /lessons": createLesson,
          "PUT /lessons": renameLesson,
          "PUT /lessons/content": replaceLessonContent,
          "DELETE /lessons": deleteLesson,
          "GET /lessons": listLessons,
          "GET /lessons/content": getLessonContent,
          "POST /attempts": submitAttempt,
          "GET /progress": getProgress,
        })
      ),
  ),
};
