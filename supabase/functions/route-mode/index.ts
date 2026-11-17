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
  saveLessonQuestions,
  updateLesson,
} from "./lessons.ts";
import { createTopic, deleteTopic, listTopics, updateTopic } from "./topics.ts";

// Modo ruta: temas con lecciones que se desbloquean con 80% de acierto.
// Gestión (administrador y profesor dueño del tema):
//   POST   /route-mode/topics              crea un tema
//   PUT    /route-mode/topics?id=          edita un tema
//   DELETE /route-mode/topics?id=          elimina un tema
//   POST   /route-mode/lessons             paso 1: crea la lección (título y texto)
//   PUT    /route-mode/lessons?id=         edita título y texto
//   DELETE /route-mode/lessons?id=         elimina la lección
//   PUT    /route-mode/lessons/questions?id= paso 2: guarda las 5 preguntas
// Lectura (cada rol ve lo suyo):
//   GET    /route-mode/topics              temas
//   GET    /route-mode/lessons?topic_id=   lecciones de un tema
//   GET    /route-mode/lessons/content?id= texto y preguntas (sin respuestas al estudiante)
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
          "PUT /lessons": updateLesson,
          "DELETE /lessons": deleteLesson,
          "GET /lessons": listLessons,
          "PUT /lessons/questions": saveLessonQuestions,
          "GET /lessons/content": getLessonContent,
          "POST /attempts": submitAttempt,
          "GET /progress": getProgress,
        })
      ),
  ),
};
