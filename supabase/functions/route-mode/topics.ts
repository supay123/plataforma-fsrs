import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";
import {
  optionalString,
  optionalUuid,
  requiredString,
  uuid,
} from "../_shared/validation.ts";
import {
  authorizedRouteCourse,
  authorizedRouteTopic,
  requireRouteManager,
  studentTeacherIds,
} from "./access.ts";
import type { CreateTopicBody, UpdateTopicBody } from "./interfaces.ts";

function queryId(request: Request): string {
  return uuid(new URL(request.url).searchParams.get("id"), "id");
}

/** POST /route-mode/topics — crea un tema al final de un curso de ruta. */
export async function createTopic(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const manager = await requireRouteManager(context);
  const body = await readJson<CreateTopicBody>(request);
  const name = requiredString(body.name, "name", 120);
  const description = optionalString(body.description, "description", 500) ??
    null;

  const course = await authorizedRouteCourse(
    context,
    manager,
    uuid(body.route_course_id, "route_course_id"),
  );

  const { data: last, error: lastError } = await context.supabaseAdmin
    .from(TABLES.routeTopics)
    .select("position")
    .eq("route_course_id", course.id)
    .order("position", { ascending: false })
    .limit(1);
  if (lastError) {
    throw new AppError(500, "route_topic_lookup_failed", lastError.message);
  }
  const { data: topic, error } = await context.supabaseAdmin
    .from(TABLES.routeTopics)
    .insert({
      college_id: course.college_id,
      teacher_id: course.teacher_id,
      route_course_id: course.id,
      name,
      description,
      position: (last?.[0]?.position ?? 0) + 1,
      created_by: manager.id,
    })
    .select("*")
    .single();
  if (error) {
    throw new AppError(400, "route_topic_create_failed", error.message);
  }
  await writeAudit(
    context,
    manager,
    "route_topic.create",
    "route_topic",
    topic.id,
  );
  return json({ topic }, 201);
}

/** PUT /route-mode/topics?id=... — cambia nombre y descripción. */
export async function updateTopic(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const manager = await requireRouteManager(context);
  const topic = await authorizedRouteTopic(context, manager, queryId(request));
  const body = await readJson<UpdateTopicBody>(request);
  const changes: { name?: string; description?: string | null } = {};
  if (body.name !== undefined) {
    changes.name = requiredString(body.name, "name", 120);
  }
  if (body.description !== undefined) {
    changes.description = body.description === null || body.description === ""
      ? null
      : requiredString(body.description, "description", 500);
  }
  if (Object.keys(changes).length === 0) {
    throw new AppError(400, "validation_error", "Nothing to update.");
  }
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.routeTopics)
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", topic.id)
    .select("*")
    .single();
  if (error) {
    throw new AppError(400, "route_topic_update_failed", error.message);
  }
  await writeAudit(
    context,
    manager,
    "route_topic.update",
    "route_topic",
    topic.id,
  );
  return json({ topic: data });
}

/** DELETE /route-mode/topics?id=... — elimina el tema con sus lecciones. */
export async function deleteTopic(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const manager = await requireRouteManager(context);
  const topic = await authorizedRouteTopic(context, manager, queryId(request));
  const { error } = await context.supabaseAdmin
    .from(TABLES.routeTopics)
    .delete()
    .eq("id", topic.id);
  if (error) {
    throw new AppError(400, "route_topic_delete_failed", error.message);
  }
  await writeAudit(
    context,
    manager,
    "route_topic.delete",
    "route_topic",
    topic.id,
  );
  return json({ deleted: true });
}

/**
 * GET /route-mode/topics[?route_course_id=...][&teacher_id=...]
 * Temas con la cantidad de lecciones. El profesor ve los suyos; el
 * administrador los de todos (o de un profesor con teacher_id); el estudiante,
 * los de sus profesores, contando solo lecciones listas. route_course_id
 * limita la lista a un curso de ruta.
 */
export async function listTopics(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const profile = await requireProfile(
    context,
    ["admin", "teacher", "student"],
    true,
  );
  let query = context.supabaseAdmin
    .from(TABLES.routeTopics)
    .select("id,teacher_id,route_course_id,name,description,position")
    .order("route_course_id")
    .order("position");
  if (profile.role === "teacher") {
    query = query.eq("teacher_id", profile.id);
  } else if (profile.role === "student") {
    const teacherIds = await studentTeacherIds(context, profile);
    if (teacherIds.length === 0) return json({ topics: [] });
    query = query.in("teacher_id", teacherIds);
  } else {
    const teacherId = optionalUuid(
      new URL(request.url).searchParams.get("teacher_id"),
      "teacher_id",
    );
    if (teacherId) query = query.eq("teacher_id", teacherId);
  }
  const routeCourseId = optionalUuid(
    new URL(request.url).searchParams.get("route_course_id"),
    "route_course_id",
  );
  if (routeCourseId) query = query.eq("route_course_id", routeCourseId);
  const { data: topics, error } = await query;
  if (error) {
    throw new AppError(500, "route_topic_lookup_failed", error.message);
  }
  if (!topics?.length) return json({ topics: [] });

  let lessonQuery = context.supabaseAdmin
    .from(TABLES.routeLessons)
    .select("topic_id,is_ready")
    .in("topic_id", topics.map((topic) => topic.id));
  if (profile.role === "student") {
    lessonQuery = lessonQuery.eq("is_ready", true);
  }
  const { data: lessons, error: lessonsError } = await lessonQuery;
  if (lessonsError) {
    throw new AppError(500, "route_lesson_lookup_failed", lessonsError.message);
  }
  const counts = new Map<string, { total: number; ready: number }>();
  for (const lesson of lessons ?? []) {
    const entry = counts.get(lesson.topic_id) ?? { total: 0, ready: 0 };
    entry.total += 1;
    if (lesson.is_ready) entry.ready += 1;
    counts.set(lesson.topic_id, entry);
  }
  const { data: teachers, error: teachersError } = await context.supabaseAdmin
    .from(TABLES.profiles)
    .select("id,full_name")
    .in("id", [...new Set(topics.map((topic) => topic.teacher_id))]);
  if (teachersError) {
    throw new AppError(500, "teacher_lookup_failed", teachersError.message);
  }
  const teacherNames = new Map(
    (teachers ?? []).map((teacher) => [teacher.id, teacher.full_name]),
  );
  return json({
    topics: topics.map((topic) => ({
      ...topic,
      teacher_name: teacherNames.get(topic.teacher_id) ?? null,
      lesson_count: counts.get(topic.id)?.total ?? 0,
      ready_lesson_count: counts.get(topic.id)?.ready ?? 0,
    })),
  });
}
