import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { encryptAnswerKey } from "../_shared/answer-key.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import type { AnswerKeyEntry } from "../_shared/interfaces/session.interfaces.ts";
import {
  parseRouteLessonContent,
  pickRandomQuestions,
} from "../_shared/route-mode.ts";
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
  RenameLessonBody,
  ReplaceLessonContentBody,
} from "./interfaces.ts";
import { loadStudentRoute, requireUnlockedLesson } from "./student-route.ts";

function queryParam(request: Request, name: string): string {
  return uuid(new URL(request.url).searchParams.get(name), name);
}

/**
 * POST /route-mode/lessons — crea una lección con su nombre al final del tema.
 * Queda sin texto ni preguntas (`is_ready` false) hasta guardar su JSON.
 */
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
      content_text: "",
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

/** PUT /route-mode/lessons?id=... — cambia el nombre de la lección. */
export async function renameLesson(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const manager = await requireRouteManager(context);
  const { lesson } = await authorizedRouteLesson(
    context,
    manager,
    queryParam(request, "id"),
  );
  const body = await readJson<RenameLessonBody>(request);
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.routeLessons)
    .update({
      title: requiredString(body.title, "title", 160),
      updated_at: new Date().toISOString(),
    })
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

/**
 * PUT /route-mode/lessons/content?id=... — guarda el JSON de la lección: texto,
 * banco de preguntas y cuántas se muestran. Las preguntas se actualizan por
 * posición (conservando sus ids, así el xp ya otorgado no se repite) y las que
 * sobran al final se eliminan. Deja la lección lista para los estudiantes.
 */
export async function replaceLessonContent(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const manager = await requireRouteManager(context);
  const { lesson } = await authorizedRouteLesson(
    context,
    manager,
    queryParam(request, "id"),
  );
  const body = await readJson<ReplaceLessonContentBody>(request);
  const content = parseRouteLessonContent(body.lesson);

  const { error: questionsError } = await context.supabaseAdmin
    .from(TABLES.routeQuestions)
    .upsert(
      content.questions.map((question, index) => ({
        ...question,
        lesson_id: lesson.id,
        position: index + 1,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "lesson_id,position" },
    );
  if (questionsError) {
    throw new AppError(
      400,
      "route_questions_save_failed",
      questionsError.message,
    );
  }
  const { error: trimError } = await context.supabaseAdmin
    .from(TABLES.routeQuestions)
    .delete()
    .eq("lesson_id", lesson.id)
    .gt("position", content.questions.length);
  if (trimError) {
    throw new AppError(400, "route_questions_save_failed", trimError.message);
  }

  const { data, error } = await context.supabaseAdmin
    .from(TABLES.routeLessons)
    .update({
      content_text: content.content_text,
      questions_to_show: content.questions_to_show,
      is_ready: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lesson.id)
    .select("id,topic_id,position,title,is_ready")
    .single();
  if (error) {
    throw new AppError(400, "route_lesson_update_failed", error.message);
  }
  await writeAudit(
    context,
    manager,
    "route_lesson.content",
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
  return json({
    topic: { id: topic.id, name: topic.name, position: topic.position },
    lessons: data ?? [],
  });
}

/**
 * GET /route-mode/lessons/content?id=...
 * Texto y preguntas de una lección. El estudiante la recibe solo si está
 * desbloqueada, con `questions_to_show` preguntas sorteadas del banco y con la
 * opción correcta y la explicación solo dentro de la clave cifrada
 * `answer_key`; el profesor y el administrador reciben todo el banco.
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
    .select(
      "id,topic_id,position,title,content_text,is_ready,questions_to_show",
    )
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

  if (profile.role !== "student") return json({ lesson, questions });

  // Igual que en la práctica: las respuestas viajan cifradas para corregir al
  // instante; la nota real la recalcula el servidor al enviar el intento.
  const answerKey: Record<string, AnswerKeyEntry> = {};
  const picked = pickRandomQuestions(questions ?? [], lesson.questions_to_show);
  const visibleQuestions = picked.map((question) => {
    const { correct_option, explanation, ...visible } = question;
    answerKey[question.id] = {
      correct_option: correct_option.trim(),
      explanation,
    };
    return visible;
  });
  return json({
    lesson,
    questions: visibleQuestions,
    answer_key: await encryptAnswerKey(answerKey),
  });
}
