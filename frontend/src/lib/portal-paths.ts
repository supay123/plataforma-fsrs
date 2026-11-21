import type { AppRole } from "../types/contracts";

const coursesBase: Record<"admin" | "teacher", string> = {
  admin: "/admin/cursos",
  teacher: "/profesor/cursos",
};

const importBase: Record<"admin" | "teacher", string> = {
  admin: "/admin/temas",
  teacher: "/profesor/temas",
};

/** Roles que administran cursos y temas (el estudiante no los usa). */
function staffRole(role: AppRole | undefined): "admin" | "teacher" {
  return role === "admin" ? "admin" : "teacher";
}

/** Ruta del detalle (temas) de un curso según el rol que la abre. */
export function courseTopicsPath(role: AppRole | undefined, courseId: string) {
  return `${coursesBase[staffRole(role)]}/${courseId}`;
}

/** Ruta de importación de preguntas de un tema según el rol que la abre. */
export function importQuestionsPath(role: AppRole | undefined, topicId: string) {
  return `${importBase[staffRole(role)]}/${topicId}/importar`;
}

const routeBase: Record<"admin" | "teacher", string> = {
  admin: "/admin/ruta",
  teacher: "/profesor/ruta",
};

/** Ruta de las lecciones de un tema del modo ruta según el rol que la abre. */
export function routeTopicLessonsPath(role: AppRole | undefined, topicId: string) {
  return `${routeBase[staffRole(role)]}/temas/${topicId}`;
}

/** Ruta del JSON de una lección del modo ruta según el rol que la abre. */
export function routeLessonJsonPath(role: AppRole | undefined, lessonId: string) {
  return `${routeBase[staffRole(role)]}/lecciones/${lessonId}/json`;
}

/** Ruta de la gestión del modo ruta según el rol que la abre. */
export function routeManagementPath(role: AppRole | undefined) {
  return routeBase[staffRole(role)];
}
