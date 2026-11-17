import { requireProfile } from "../_shared/auth.ts";
import { AppError } from "../_shared/errors.ts";
import type { RankingType } from "../_shared/interfaces/ranking.interfaces.ts";
import { availableCategories } from "../_shared/ranking.ts";
import type { AppProfile, EdgeContext } from "../_shared/types.ts";
import { loadMedalRules } from "../medals/settings.ts";
import { loadRankingSettings } from "./settings.ts";

/**
 * Estudiante o profesor con el ranking activado en su institución y la
 * categoría pedida disponible; si no, 403.
 */
export async function requireRankingAccess(
  context: EdgeContext,
  type: RankingType,
): Promise<AppProfile & { college_id: string }> {
  const user = await requireProfile(context, ["student", "teacher"], true);
  if (!user.college_id) {
    throw new AppError(409, "college_required", "The user has no college.");
  }
  const { settings } = await loadRankingSettings(context, user.college_id);
  if (!settings.enabled) {
    throw new AppError(403, "ranking_disabled", "The ranking is disabled.");
  }
  const { rules } = await loadMedalRules(context, user.college_id);
  if (!availableCategories(settings, rules.enabled).includes(type)) {
    throw new AppError(
      403,
      "ranking_category_disabled",
      "This ranking category is not available.",
    );
  }
  return { ...user, college_id: user.college_id };
}
