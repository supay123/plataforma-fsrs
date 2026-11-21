import { requireProfile } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { loadMedalRules } from "./settings.ts";

/**
 * Mejor marca de estrellas (0-3) del estudiante en cada tema donde ya practicó.
 * Los temas que no aparecen tienen 0 estrellas.
 */
export async function getTopicStars(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"], true);
  if (!student.college_id) {
    throw new AppError(409, "college_required", "The student has no college.");
  }
  const { rules } = await loadMedalRules(context, student.college_id);
  if (!rules.enabled) return json({ enabled: false, topics: [] });

  const { data, error } = await context.supabaseAdmin
    .from(TABLES.studentTopicStars)
    .select("topic_id,best_stars,completed")
    .eq("student_id", student.id);
  if (error) throw new AppError(500, "topic_stars_failed", error.message);
  return json({ enabled: true, topics: data ?? [] });
}
