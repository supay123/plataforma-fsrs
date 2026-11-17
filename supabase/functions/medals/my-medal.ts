import { requireProfile } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import { MEDAL_NAMES, medalForStars, medalRanges } from "../_shared/medals.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { loadMedalRules } from "./settings.ts";

/**
 * Medalla y estrellas actuales del estudiante, con la medalla siguiente y las
 * estrellas que le faltan. La medalla se calcula con los rangos vigentes de su
 * colegio, así que refleja de inmediato los cambios del admin.
 */
export async function getMyMedal(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"], true);
  if (!student.college_id) {
    throw new AppError(409, "college_required", "The student has no college.");
  }
  const { rules } = await loadMedalRules(context, student.college_id);
  if (!rules.enabled) return json({ enabled: false });

  const { data, error } = await context.supabaseAdmin
    .from(TABLES.studentMedals)
    .select("stars")
    .eq("student_id", student.id)
    .maybeSingle();
  if (error) throw new AppError(500, "student_medal_failed", error.message);

  const stars = data?.stars ?? 0;
  const ranges = medalRanges(rules.star_range_ends);
  const code = medalForStars(stars, rules.star_range_ends);
  const index = MEDAL_NAMES.findIndex(([medalCode]) => medalCode === code);
  const next = ranges[index + 1];
  return json({
    enabled: true,
    stars,
    medal: ranges[index],
    next_medal: next ?? null,
    stars_to_next: next ? next.min_stars - stars : null,
  });
}
