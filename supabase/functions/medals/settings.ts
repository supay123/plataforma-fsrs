import { TABLES } from "../_shared/database.constants.ts";
import { AppError } from "../_shared/errors.ts";
import type {
  MedalRules,
  MedalSettingsResponse,
} from "../_shared/interfaces/medal.interfaces.ts";
import {
  DEFAULT_MEDAL_RULES,
  gradeRanges,
  medalRanges,
} from "../_shared/medals.ts";
import type { EdgeContext } from "../_shared/types.ts";

export function settingsResponse(
  collegeId: string,
  rules: MedalRules,
  isDefault: boolean,
): MedalSettingsResponse {
  return {
    college_id: collegeId,
    is_default: isDefault,
    ...rules,
    medals: medalRanges(rules.star_range_ends),
    grade_ranges: gradeRanges(rules.grade_range_ends),
  };
}

/** Reglas guardadas de la institución; sin fila devuelve las de por defecto. */
export async function loadMedalRules(
  context: EdgeContext,
  collegeId: string,
): Promise<{ rules: MedalRules; isDefault: boolean }> {
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.collegeMedalSettings)
    .select("enabled,star_range_ends,grade_range_ends")
    .eq("college_id", collegeId)
    .maybeSingle();
  if (error) throw new AppError(500, "medal_settings_failed", error.message);
  return data
    ? { rules: data, isDefault: false }
    : { rules: DEFAULT_MEDAL_RULES, isDefault: true };
}
