import { invokeFunction } from "../../lib/api/functions";
import type { EncryptedAnswerKey } from "../../types/contracts";

export type RouteOption = "A" | "B" | "C" | "D";
export type RouteLessonStatus = "locked" | "available" | "completed";

/** Tema de la ruta de un profesor (vista de gestión). */
export interface RouteTopic {
  id: string; teacher_id: string; teacher_name: string | null; name: string; description: string | null;
  position: number; lesson_count: number; ready_lesson_count: number;
}
/** Lección en la vista de gestión; `is_ready` es true cuando ya tiene su banco de preguntas. */
export interface RouteLessonSummary { id: string; topic_id: string; position: number; title: string; is_ready: boolean }

export interface RouteLessonProgress { id: string; topic_id: string; position: number; title: string; status: RouteLessonStatus; best_percent: number | null; attempts: number }
export interface RouteTopicProgress { id: string; teacher_id: string; name: string; description: string | null; position: number; lessons: RouteLessonProgress[]; completed_lessons: number }
export interface RouteProgress { pass_percent: number; topics: RouteTopicProgress[] }

/** Pregunta tal como va en el JSON de la lección. */
export interface RouteQuestionJson {
  statement: string; option_a: string; option_b: string; option_c: string; option_d: string;
  correct_option: RouteOption; explanation?: string;
}
/** Contenido de una lección tal como va en su JSON: `questions_to_show` de las `questions` se sortean en cada intento. */
export interface RouteLessonJson { text: string; questions_to_show: number; questions: RouteQuestionJson[] }
export interface RouteQuestion {
  id: string; position: number; statement: string; option_a: string; option_b: string; option_c: string; option_d: string;
  /** Solo los administradores y profesores reciben la respuesta correcta y la explicación. */
  correct_option?: RouteOption; explanation?: string | null;
}
export interface RouteLessonContent {
  lesson: { id: string; topic_id: string; position: number; title: string; content_text: string; is_ready: boolean; questions_to_show: number };
  questions: RouteQuestion[];
  /** Solo al estudiante: respuestas cifradas (como en la práctica) para corregir cada pregunta al instante. */
  answer_key?: EncryptedAnswerKey;
}

export interface RouteAttemptResult {
  attempt_id: string; correct_count: number; total_questions: number; score_percent: number; passed: boolean;
  pass_percent: number; next_lesson_id: string | null;
  xp: { xp_gained: number; level_before: number; xp_before: number; level: number; xp: number; thresholds: number[] };
}

const none = {};
const idQuery = (path: string, id: string) => `route-mode/${path}?id=${encodeURIComponent(id)}`;

export const routeProgressKey = ["route-progress"] as const;
/** Prefijo de todas las listas de temas: invalida las de cualquier profesor. */
export const routeTopicsPrefix = ["route-topics"] as const;
export const routeTopicsKey = (teacherId: string | null) => ["route-topics", teacherId] as const;
export const routeLessonsKey = (topicId: string | null) => ["route-lessons", topicId] as const;
export const routeLessonContentKey = (lessonId: string) => ["route-lesson-content", lessonId] as const;

export async function getRouteProgress() {
  return invokeFunction<RouteProgress, typeof none>("route-mode/progress", none, { method: "GET" });
}

/** GET /route-mode/topics: el profesor recibe los suyos; el administrador filtra por `teacherId`. */
export async function listRouteTopics(teacherId?: string | null) {
  const query = teacherId ? `?teacher_id=${encodeURIComponent(teacherId)}` : "";
  const { topics } = await invokeFunction<{ topics: RouteTopic[] }, typeof none>(`route-mode/topics${query}`, none, { method: "GET" });
  return topics;
}
export function createRouteTopic(body: { name: string; description?: string; teacher_id?: string }) {
  return invokeFunction<{ topic: { id: string } }, typeof body>("route-mode/topics", body);
}
export function updateRouteTopic(topicId: string, body: { name?: string; description?: string | null }) {
  return invokeFunction<{ topic: { id: string } }, typeof body>(idQuery("topics", topicId), body, { method: "PUT" });
}
export function deleteRouteTopic(topicId: string) {
  return invokeFunction<{ deleted: boolean }, typeof none>(idQuery("topics", topicId), none, { method: "DELETE" });
}

/** Lecciones de un tema con el tema al que pertenecen (solo administrador y profesor). */
export function listRouteLessons(topicId: string) {
  return invokeFunction<{ topic: { id: string; name: string; position: number }; lessons: RouteLessonSummary[] }, typeof none>(`route-mode/lessons?topic_id=${encodeURIComponent(topicId)}`, none, { method: "GET" });
}
/** Crea la lección con su nombre; queda sin contenido hasta guardar su JSON. */
export function createRouteLesson(body: { topic_id: string; title: string }) {
  return invokeFunction<{ lesson: RouteLessonSummary }, typeof body>("route-mode/lessons", body);
}
export function renameRouteLesson(lessonId: string, title: string) {
  const body = { title };
  return invokeFunction<{ lesson: RouteLessonSummary }, typeof body>(idQuery("lessons", lessonId), body, { method: "PUT" });
}
/** Guarda el JSON de la lección: texto, banco de preguntas y cuántas se muestran. */
export function saveRouteLessonContent(lessonId: string, lesson: unknown) {
  const body = { lesson };
  return invokeFunction<{ lesson: RouteLessonSummary }, typeof body>(idQuery("lessons/content", lessonId), body, { method: "PUT" });
}
export function deleteRouteLesson(lessonId: string) {
  return invokeFunction<{ deleted: boolean }, typeof none>(idQuery("lessons", lessonId), none, { method: "DELETE" });
}
export function getRouteLessonContent(lessonId: string) {
  return invokeFunction<RouteLessonContent, typeof none>(idQuery("lessons/content", lessonId), none, { method: "GET" });
}

export function submitRouteAttempt(body: { lesson_id: string; answers: Array<{ question_id: string; selected_option: RouteOption }> }) {
  return invokeFunction<RouteAttemptResult, typeof body>("route-mode/attempts", body);
}

/** Tipo de ayuda para el nombre mostrado de un tema: "Tema 1: Probabilidad". */
export const routeTopicTitle = (topic: { position: number; name: string }) => `Tema ${topic.position}: ${topic.name}`;
