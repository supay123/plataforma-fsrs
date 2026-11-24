import { requireProfile } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import type { Tables } from "../_shared/database.types.ts";
import { AppError } from "../_shared/errors.ts";
import type { AppProfile, EdgeContext } from "../_shared/types.ts";

export type RouteCourseRow = Tables<"route_courses">;
export type RouteTopicRow = Tables<"route_topics">;
export type RouteLessonRow = Tables<"route_lessons">;

/** Administradores y profesores gestionan el modo ruta. */
export function requireRouteManager(context: EdgeContext): Promise<AppProfile> {
  return requireProfile(context, ["admin", "teacher"]);
}

/** El profesor solo toca sus cursos de ruta; el administrador, los de cualquiera. */
export async function authorizedRouteCourse(
  context: EdgeContext,
  manager: AppProfile,
  courseId: string,
): Promise<RouteCourseRow> {
  const { data: course, error } = await context.supabaseAdmin
    .from(TABLES.routeCourses)
    .select("*")
    .eq("id", courseId)
    .maybeSingle();
  if (error) {
    throw new AppError(500, "route_course_lookup_failed", error.message);
  }
  if (!course) {
    throw new AppError(404, "route_course_not_found", "Course not found.");
  }
  if (manager.role === "teacher" && course.teacher_id !== manager.id) {
    throw new AppError(
      403,
      "forbidden",
      "The teacher does not own this course.",
    );
  }
  return course;
}

/** El profesor solo toca sus temas; el administrador, los de cualquiera. */
export async function authorizedRouteTopic(
  context: EdgeContext,
  manager: AppProfile,
  topicId: string,
): Promise<RouteTopicRow> {
  const { data: topic, error } = await context.supabaseAdmin
    .from(TABLES.routeTopics)
    .select("*")
    .eq("id", topicId)
    .maybeSingle();
  if (error) {
    throw new AppError(500, "route_topic_lookup_failed", error.message);
  }
  if (!topic) {
    throw new AppError(404, "route_topic_not_found", "Topic not found.");
  }
  if (manager.role === "teacher" && topic.teacher_id !== manager.id) {
    throw new AppError(
      403,
      "forbidden",
      "The teacher does not own this topic.",
    );
  }
  return topic;
}

export async function authorizedRouteLesson(
  context: EdgeContext,
  manager: AppProfile,
  lessonId: string,
): Promise<{ lesson: RouteLessonRow; topic: RouteTopicRow }> {
  const { data: lesson, error } = await context.supabaseAdmin
    .from(TABLES.routeLessons)
    .select("*")
    .eq("id", lessonId)
    .maybeSingle();
  if (error) {
    throw new AppError(500, "route_lesson_lookup_failed", error.message);
  }
  if (!lesson) {
    throw new AppError(404, "route_lesson_not_found", "Lesson not found.");
  }
  const topic = await authorizedRouteTopic(context, manager, lesson.topic_id);
  return { lesson, topic };
}

/** Profesores de los cursos en los que el estudiante está matriculado. */
export async function studentTeacherIds(
  context: EdgeContext,
  student: AppProfile,
): Promise<string[]> {
  const { data: enrollments, error } = await context.supabaseAdmin
    .from(TABLES.courseEnrollments)
    .select("course_id")
    .eq("student_id", student.id)
    .eq("status", "active");
  if (error) throw new AppError(500, "enrollment_lookup_failed", error.message);
  const courseIds = (enrollments ?? []).map((row) => row.course_id);
  if (courseIds.length === 0) return [];
  const { data: courses, error: coursesError } = await context.supabaseAdmin
    .from(TABLES.courses)
    .select("teacher_id")
    .in("id", courseIds);
  if (coursesError) {
    throw new AppError(500, "course_lookup_failed", coursesError.message);
  }
  return [...new Set((courses ?? []).map((course) => course.teacher_id))];
}
