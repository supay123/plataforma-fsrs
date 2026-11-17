import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { parseRouteQuestions, routeLessonText } from "../_shared/route-mode.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { requiredString, uuid } from "../_shared/validation.ts";
import {
  authorizedRouteLesson,
  authorizedRouteTopic,
  requireRouteManager,
  studentTeacherIds,
} from "./access.ts";
import type {
  CreateLessonBody,
  SaveLessonQuestionsBody,
  UpdateLessonBody,
} from "./interfaces.ts";
import { loadStudentRoute, requireUnlockedLesson } from "./student-route.ts";

function queryParam(request: Request, name: string): string {
  return uuid(new URL(request.url).searchParams.get(name), name);
}

/** POST /route-mode/lessons — paso 1: crea la lección con su título y texto. */
export async function createLesson(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const manager = await requireRouteManager(context);
  const body = await readJson<CreateLessonBody>(request);
  const topic = await authorizedRouteTopic(
    context,
    manager,
    uuid(body.topic_id, "topic_id"),
  );
  const title = requiredString(body.title, "title", 160);
  const contentText = routeLessonText(body.content_text);

  const { data: last, error: lastError } = await context.supabaseAdmin
    .from(TABLES.routeLessons)
    .select("position")
    .eq("topic_id", topic.id)
    .order("position", { ascending: false })
    .limit(1);
  if (lastError) {
    throw new AppError(500, "route_lesson_lookup_failed", lastError.message);
  }
  const { data: lesson, error } = await context.supabaseAdmin
    .from(TABLES.routeLessons)
    .insert({
      topic_id: topic.id,
      title,
      content_text: contentText,
      position: (last?.[0]?.position ?? 0) + 1,
      created_by: manager.id,
    })
    .select("id,topic_id,position,title,is_ready")
    .single();
  if (error) {
    throw new AppError(400, "route_lesson_create_failed", error.message);
  }
  await writeAudit(
    context,
    manager,
    "route_lesson.create",
    "route_lesson",
    lesson.id,
  );
  return json({ lesson }, 201);
}

/** PUT /route-mode/lessons?id=... — edita título y texto de la lección. */
export async function updateLesson(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const manager = await requireRouteManager(context);
  const { lesson } = await authorizedRouteLesson(
    context,
    manager,
    queryParam(request, "id"),
  );
  const body = await readJson<UpdateLessonBody>(request);
  const changes: { title?: string; content_text?: string } = {};
  if (body.title !== undefined) {
    changes.title = requiredString(body.title, "title", 160);
  }
  if (body.content_text !== undefined) {
    changes.content_text = routeLessonText(body.content_text);
  }
  if (Object.keys(changes).length === 0) {
    throw new AppError(400, "validation_error", "Nothing to update.");
  }
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.routeLessons)
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", lesson.id)
    .select("id,topic_id,position,title,is_ready")
    .single();
  if (error) {
    throw new AppError(400, "route_lesson_update_failed", error.message);
  }
  await writeAudit(
    context,
    manager,
    "route_lesson.update",
    "route_lesson",
    lesson.id,
  );
  return json({ lesson: data });
}

/** DELETE /route-mode/lessons?id=... — elimina la lección y sus preguntas. */
export async function deleteLesson(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const manager = await requireRouteManager(context);
  const { lesson } = await authorizedRouteLesson(
    context,
    manager,
    queryParam(request, "id"),
  );
  const { error } = await context.supabaseAdmin
    .from(TABLES.routeLessons)
    .delete()
    .eq("id", lesson.id);
  if (error) {
    throw new AppError(400, "route_lesson_delete_failed", error.message);
  }
  await writeAudit(
    context,
    manager,
    "route_lesson.delete",
    "route_lesson",
    lesson.id,
  );
  return json({ deleted: true });
}

/**
 * PUT /route-mode/lessons/questions?id=... — paso 2: guarda exactamente las 5
 * preguntas. Reemplaza las anteriores por posición (conservando sus ids, así
 * el xp ya otorgado por una pregunta no se repite) y deja la lección lista.
 */
export async function saveLessonQuestions(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const manager = await requireRouteManager(context);
  const { lesson } = await authorizedRouteLesson(
    context,
    manager,
    queryParam(request, "id"),
  );
  const body = await readJson<SaveLessonQuestionsBody>(request);
  const questions = parseRouteQuestions(body.questions);

  const { error } = await context.supabaseAdmin
    .from(TABLES.routeQuestions)
    .upsert(
      questions.map((question, index) => ({
        ...question,
        lesson_id: lesson.id,
        position: index + 1,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "lesson_id,position" },
    );
  if (error) {
    throw new AppError(400, "route_questions_save_failed", error.message);
  }

  const { error: readyError } = await context.supabaseAdmin
    .from(TABLES.routeLessons)
    .update({ is_ready: true, updated_at: new Date().toISOString() })
    .eq("id", lesson.id);
  if (readyError) {
    throw new AppError(400, "route_lesson_update_failed", readyError.message);
  }
  await writeAudit(
    context,
    manager,
    "route_lesson.questions",
    "route_lesson",
    lesson.id,
  );
  return json({ saved: true, lesson_id: lesson.id, is_ready: true });
}

/**
 * GET /route-mode/lessons?topic_id=...
 * Lecciones de un tema. Para el profesor y el administrador, todas (con su
 * estado de preparación); para el estudiante, solo las listas con su estado
 * (locked, available o completed) y su mejor porcentaje.
 */
export async function listLessons(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const profile = await requireProfile(
    context,
    ["admin", "teacher", "student"],
    true,
  );
  const topicId = queryParam(request, "topic_id");

  if (profile.role === "student") {
    const teacherIds = await studentTeacherIds(context, profile);
    const route = await loadStudentRoute(context, profile);
    const topic = route.find((entry) => entry.id === topicId);
    if (!topic || !teacherIds.includes(topic.teacher_id)) {
      throw new AppError(404, "route_topic_not_found", "Topic not found.");
    }
    return json({ lessons: topic.lessons });
  }

  const topic = await authorizedRouteTopic(context, profile, topicId);
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.routeLessons)
    .select("id,topic_id,position,title,is_ready")
    .eq("topic_id", topic.id)
    .order("position");
  if (error) {
    throw new AppError(500, "route_lesson_lookup_failed", error.message);
  }
  return json({ lessons: data ?? [] });
}

/**
 * GET /route-mode/lessons/content?id=...
 * Texto y preguntas de una lección. El estudiante la recibe solo si está
 * desbloqueada y sin la opción correcta ni la explicación; el profesor y el
 * administrador reciben todo para editarla.
 */
export async function getLessonContent(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const profile = await requireProfile(
    context,
    ["admin", "teacher", "student"],
    true,
  );
  const lessonId = queryParam(request, "id");

  if (profile.role === "student") {
    await requireUnlockedLesson(context, profile, lessonId);
  } else {
    await authorizedRouteLesson(context, profile, lessonId);
  }

  const { data: lesson, error } = await context.supabaseAdmin
    .from(TABLES.routeLessons)
    .select("id,topic_id,position,title,content_text,is_ready")
    .eq("id", lessonId)
    .single();
  if (error) {
    throw new AppError(500, "route_lesson_lookup_failed", error.message);
  }

  const { data: questions, error: questionsError } = await context.supabaseAdmin
    .from(TABLES.routeQuestions)
    .select(
      "id,position,statement,option_a,option_b,option_c,option_d,correct_option,explanation",
    )
    .eq("lesson_id", lessonId)
    .order("position");
  if (questionsError) {
    throw new AppError(
      500,
      "route_question_lookup_failed",
      questionsError.message,
    );
  }

  return json({
    lesson,
    questions: (questions ?? []).map((question) => {
      if (profile.role !== "student") return question;
      const { correct_option: _hidden, explanation: _explanation, ...visible } =
        question;
      return visible;
    }),
  });
}
