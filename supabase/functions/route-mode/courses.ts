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
  requireRouteManager,
  studentTeacherIds,
} from "./access.ts";
import type { CreateCourseBody, UpdateCourseBody } from "./interfaces.ts";

const POSTGRES_UNIQUE_VIOLATION = "23505";

function courseWriteError(
  error: { code?: string; message: string },
  code: string,
): AppError {
  if (error.code === POSTGRES_UNIQUE_VIOLATION) {
    return new AppError(
      409,
      "route_course_name_taken",
      "Ya existe un curso con ese nombre.",
    );
  }
  return new AppError(400, code, error.message);
}

/** POST /route-mode/courses — crea un curso de ruta al final de los del profesor. */
export async function createCourse(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const manager = await requireRouteManager(context);
  const body = await readJson<CreateCourseBody>(request);
  const name = requiredString(body.name, "name", 120);
  const description = optionalString(body.description, "description", 500) ??
    null;

  let teacherId = manager.id;
  let collegeId = manager.college_id;
  if (manager.role === "admin") {
    teacherId = uuid(body.teacher_id, "teacher_id");
    const { data: teacher, error } = await context.supabaseAdmin
      .from(TABLES.profiles)
      .select("id,college_id,role,is_active")
      .eq("id", teacherId)
      .maybeSingle();
    if (error) throw new AppError(500, "teacher_lookup_failed", error.message);
    if (!teacher || teacher.role !== "teacher" || !teacher.is_active) {
      throw new AppError(404, "teacher_not_found", "Teacher not found.");
    }
    collegeId = teacher.college_id;
  }
  if (!collegeId) {
    throw new AppError(409, "college_required", "The teacher has no college.");
  }

  const { data: last, error: lastError } = await context.supabaseAdmin
    .from(TABLES.routeCourses)
    .select("position")
    .eq("teacher_id", teacherId)
    .order("position", { ascending: false })
    .limit(1);
  if (lastError) {
    throw new AppError(500, "route_course_lookup_failed", lastError.message);
  }
  const { data: course, error } = await context.supabaseAdmin
    .from(TABLES.routeCourses)
    .insert({
      college_id: collegeId,
      teacher_id: teacherId,
      name,
      description,
      position: (last?.[0]?.position ?? 0) + 1,
      created_by: manager.id,
    })
    .select("*")
    .single();
  if (error) throw courseWriteError(error, "route_course_create_failed");
  await writeAudit(
    context,
    manager,
    "route_course.create",
    "route_course",
    course.id,
  );
  return json({ course }, 201);
}

/** PUT /route-mode/courses?id=... — cambia nombre y descripción. */
export async function updateCourse(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const manager = await requireRouteManager(context);
  const course = await authorizedRouteCourse(
    context,
    manager,
    uuid(new URL(request.url).searchParams.get("id"), "id"),
  );
  const body = await readJson<UpdateCourseBody>(request);
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
    .from(TABLES.routeCourses)
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", course.id)
    .select("*")
    .single();
  if (error) throw courseWriteError(error, "route_course_update_failed");
  await writeAudit(
    context,
    manager,
    "route_course.update",
    "route_course",
    course.id,
  );
  return json({ course: data });
}

/** DELETE /route-mode/courses?id=... — elimina el curso con sus temas y lecciones. */
export async function deleteCourse(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const manager = await requireRouteManager(context);
  const course = await authorizedRouteCourse(
    context,
    manager,
    uuid(new URL(request.url).searchParams.get("id"), "id"),
  );
  const { error } = await context.supabaseAdmin
    .from(TABLES.routeCourses)
    .delete()
    .eq("id", course.id);
  if (error) {
    throw new AppError(400, "route_course_delete_failed", error.message);
  }
  await writeAudit(
    context,
    manager,
    "route_course.delete",
    "route_course",
    course.id,
  );
  return json({ deleted: true });
}

/**
 * GET /route-mode/courses[?teacher_id=...]
 * Cursos de ruta con la cantidad de temas. El profesor ve los suyos; el
 * administrador los de un profesor (teacher_id); el estudiante, los de sus
 * profesores.
 */
export async function listCourses(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const profile = await requireProfile(
    context,
    ["admin", "teacher", "student"],
    true,
  );
  let query = context.supabaseAdmin
    .from(TABLES.routeCourses)
    .select("id,teacher_id,name,description,position")
    .order("teacher_id")
    .order("position");
  if (profile.role === "teacher") {
    query = query.eq("teacher_id", profile.id);
  } else if (profile.role === "student") {
    const teacherIds = await studentTeacherIds(context, profile);
    if (teacherIds.length === 0) return json({ courses: [] });
    query = query.in("teacher_id", teacherIds);
  } else {
    const teacherId = optionalUuid(
      new URL(request.url).searchParams.get("teacher_id"),
      "teacher_id",
    );
    if (teacherId) query = query.eq("teacher_id", teacherId);
  }
  const { data: courses, error } = await query;
  if (error) {
    throw new AppError(500, "route_course_lookup_failed", error.message);
  }
  if (!courses?.length) return json({ courses: [] });

  const { data: topics, error: topicsError } = await context.supabaseAdmin
    .from(TABLES.routeTopics)
    .select("route_course_id")
    .in("route_course_id", courses.map((course) => course.id));
  if (topicsError) {
    throw new AppError(500, "route_topic_lookup_failed", topicsError.message);
  }
  const topicCounts = new Map<string, number>();
  for (const topic of topics ?? []) {
    topicCounts.set(
      topic.route_course_id,
      (topicCounts.get(topic.route_course_id) ?? 0) + 1,
    );
  }
  return json({
    courses: courses.map((course) => ({
      ...course,
      topic_count: topicCounts.get(course.id) ?? 0,
    })),
  });
}
