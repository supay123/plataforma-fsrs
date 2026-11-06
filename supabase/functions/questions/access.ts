import { requireProfile } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError } from "../_shared/errors.ts";
import type { AppProfile, EdgeContext } from "../_shared/types.ts";

/**
 * Comprueba que el tema exista y que el profesor lo dicte. Los administradores
 * pueden gestionar las preguntas de cualquier tema.
 */
export async function authorizedTopic(
  context: EdgeContext,
  topicId: string,
): Promise<AppProfile> {
  const profile = await requireProfile(context, ["admin", "teacher"]);
  const { data: topic, error } = await context.supabaseAdmin
    .from(TABLES.topics)
    .select("id,courses!inner(id,teacher_id)")
    .eq("id", topicId)
    .maybeSingle();
  if (error || !topic) {
    throw new AppError(404, "topic_not_found", "Topic not found.");
  }
  const course = Array.isArray(topic.courses)
    ? topic.courses[0]
    : topic.courses;
  if (profile.role === "teacher" && course?.teacher_id !== profile.id) {
    throw new AppError(
      403,
      "forbidden",
      "The teacher does not own this topic.",
    );
  }
  return profile;
}
