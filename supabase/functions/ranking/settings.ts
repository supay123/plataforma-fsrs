import { TABLES } from "../_shared/database.constants.ts";
import { AppError } from "../_shared/errors.ts";
import type {
  RankingSettings,
  RankingSettingsResponse,
} from "../_shared/interfaces/ranking.interfaces.ts";
import {
  availableCategories,
  DEFAULT_RANKING_SETTINGS,
} from "../_shared/ranking.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { loadMedalRules } from "../medals/settings.ts";

/** Configuración guardada de la institución; sin fila devuelve la de por defecto (desactivado). */
export async function loadRankingSettings(
  context: EdgeContext,
  collegeId: string,
): Promise<{ settings: RankingSettings; isDefault: boolean }> {
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.collegeRankingSettings)
    .select("enabled,categories")
    .eq("college_id", collegeId)
    .maybeSingle();
  if (error) throw new AppError(500, "ranking_settings_failed", error.message);
  return data
    ? { settings: data, isDefault: false }
    : { settings: DEFAULT_RANKING_SETTINGS, isDefault: true };
}

export async function rankingSettingsResponse(
  context: EdgeContext,
  collegeId: string,
  settings: RankingSettings,
  isDefault: boolean,
): Promise<RankingSettingsResponse> {
  const { rules } = await loadMedalRules(context, collegeId);
  const available = availableCategories(settings, rules.enabled);
  return {
    college_id: collegeId,
    is_default: isDefault,
    ...settings,
    available_categories: available,
    visible: available.length > 0,
  };
}
