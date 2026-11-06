import "@supabase/functions-js/edge-runtime.d.ts";
import { handle } from "../_shared/errors.ts";
import { routeRequest } from "../_shared/router.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { archiveQuestionHandler } from "./archive-question.ts";
import { archiveTopicQuestionsHandler } from "./archive-topic-questions.ts";
import { listQuestionsHandler } from "./list-questions.ts";

// Preguntas de un tema (administradores y profesores dueños del tema).
//   GET    /questions?topic_id=...       preguntas vigentes del tema
//   DELETE /questions?id=...             archiva una pregunta
//   DELETE /questions/topic?topic_id=... archiva todas las preguntas del tema
export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(() =>
        routeRequest(request, context, "questions", {
          "GET /": listQuestionsHandler,
          "DELETE /": archiveQuestionHandler,
          "DELETE /topic": archiveTopicQuestionsHandler,
        })
      ),
  ),
};
