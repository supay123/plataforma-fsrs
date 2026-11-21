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
import { createTopic, deleteTopic, listTopics, updateTopic } from "./topics.ts";

// Modo ruta: temas con lecciones que se desbloquean con 80% de acierto.
// Gestión (administrador y profesor dueño del tema):
//   POST   /route-mode/topics              crea un tema
//   PUT    /route-mode/topics?id=          edita un tema
//   DELETE /route-mode/topics?id=          elimina un tema
//   POST   /route-mode/lessons             crea una lección con su nombre (aún sin contenido)
//   PUT    /route-mode/lessons?id=         cambia el nombre de la lección
//   PUT    /route-mode/lessons/content?id= guarda el JSON: texto y banco de preguntas
//   DELETE /route-mode/lessons?id=         elimina la lección
// Lectura (cada rol ve lo suyo):
//   GET    /route-mode/topics              temas
//   GET    /route-mode/lessons?topic_id=   lecciones de un tema
//   GET    /route-mode/lessons/content?id= texto y preguntas (al estudiante, sorteadas y con respuestas cifradas en answer_key)
// Estudiante:
//   POST   /route-mode/attempts            envía un intento; califica y da xp
//   GET    /route-mode/progress            temas, lecciones y desbloqueos
export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "route-mode", {
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
