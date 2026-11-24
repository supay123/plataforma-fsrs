import { TABLES } from "../_shared/database.constants.ts";
import { AppError } from "../_shared/errors.ts";
import type {
  RouteAttemptRecord,
  RouteTopicProgress,
} from "../_shared/interfaces/route-mode.interfaces.ts";
import { buildRouteProgress } from "../_shared/route-mode.ts";
import type { AppProfile, EdgeContext } from "../_shared/types.ts";
import { studentTeacherIds } from "./access.ts";

/** Cursos de ruta de los profesores del estudiante, con el nombre del profesor. */
export async function loadStudentRouteCourses(
  context: EdgeContext,
  student: AppProfile,
) {
  const teacherIds = await studentTeacherIds(context, student);
  if (teacherIds.length === 0) return [];
  const { data: courses, error } = await context.supabaseAdmin
    .from(TABLES.routeCourses)
    .select("id,teacher_id,name,description,position")
    .in("teacher_id", teacherIds)
    .order("position");
  if (error) {
    throw new AppError(500, "route_course_lookup_failed", error.message);
  }
  const { data: teachers, error: teachersError } = await context.supabaseAdmin
    .from(TABLES.profiles)
    .select("id,full_name")
    .in("id", teacherIds);
  if (teachersError) {
    throw new AppError(500, "teacher_lookup_failed", teachersError.message);
  }
  const teacherNames = new Map(
    (teachers ?? []).map((teacher) => [teacher.id, teacher.full_name]),
  );
  return (courses ?? []).map((course) => ({
    ...course,
    teacher_name: teacherNames.get(course.teacher_id) ?? null,
  }));
}

/**
 * Temas y lecciones listas de los cursos de ruta de los profesores del estudiante, con el estado de cada
 * lección. Es la única fuente de la regla de bloqueo: la usan el progreso, la
 * lista de lecciones, el contenido y el envío de intentos.
 */
export async function loadStudentRoute(
  context: EdgeContext,
  student: AppProfile,
): Promise<RouteTopicProgress[]> {
  const teacherIds = await studentTeacherIds(context, student);
  if (teacherIds.length === 0) return [];

  const { data: topics, error: topicsError } = await context.supabaseAdmin
    .from(TABLES.routeTopics)
    .select("id,teacher_id,route_course_id,name,description,position")
    .in("teacher_id", teacherIds);
  if (topicsError) {
    throw new AppError(500, "route_topic_lookup_failed", topicsError.message);
  }
  if (!topics?.length) return [];

  const { data: lessons, error: lessonsError } = await context.supabaseAdmin
    .from(TABLES.routeLessons)
    .select("id,topic_id,position,title")
    .in("topic_id", topics.map((topic) => topic.id))
    .eq("is_ready", true);
  if (lessonsError) {
    throw new AppError(500, "route_lesson_lookup_failed", lessonsError.message);
  }

  let attempts: RouteAttemptRecord[] = [];
  if (lessons?.length) {
    const { data, error } = await context.supabaseAdmin
      .from(TABLES.routeLessonAttempts)
      .select("lesson_id,score_percent,passed")
      .eq("student_id", student.id)
      .in("lesson_id", lessons.map((lesson) => lesson.id));
    if (error) {
      throw new AppError(500, "route_attempt_lookup_failed", error.message);
    }
    attempts = data ?? [];
  }
  return buildRouteProgress(topics, lessons ?? [], attempts);
}

/** Estado de una lección para el estudiante, o 404/403 si no puede usarla. */
export async function requireUnlockedLesson(
  context: EdgeContext,
  student: AppProfile,
  lessonId: string,
): Promise<{ topic: RouteTopicProgress; lessonTitle: string }> {
  const route = await loadStudentRoute(context, student);
  for (const topic of route) {
    const lesson = topic.lessons.find((entry) => entry.id === lessonId);
    if (!lesson) continue;
    if (lesson.status === "locked") {
      throw new AppError(
        403,
        "lesson_locked",
        "Debes aprobar la lección anterior (80% o más) para abrir esta.",
      );
    }
    return { topic, lessonTitle: lesson.title };
  }
  throw new AppError(404, "route_lesson_not_found", "Lesson not found.");
}
