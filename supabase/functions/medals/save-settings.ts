import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { parseGradeRangeEnds, parseStarRangeEnds } from "../_shared/medals.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { boolean, uuid } from "../_shared/validation.ts";
import type { SaveMedalSettingsBody } from "./interfaces.ts";
import { loadMedalRules, settingsResponse } from "./settings.ts";

/**
 * Modifica la configuración de medallas de una institución (solo admin). Los
 * campos que no se envían conservan su valor; si la institución no tiene fila
 * se crea con los valores por defecto más lo enviado.
 */
export async function saveMedalSettings(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const admin = await requireProfile(context, ["admin"]);
  const body = await readJson<SaveMedalSettingsBody>(request);
  const collegeId = uuid(body.college_id, "college_id");

  const { data: college, error: collegeError } = await context.supabaseAdmin
    .from(TABLES.colleges)
    .select("id")
    .eq("id", collegeId)
    .maybeSingle();
  if (collegeError || !college) {
    throw new AppError(404, "college_not_found", "College not found.");
  }

  const { rules } = await loadMedalRules(context, collegeId);
  const next = {
    enabled: body.enabled === undefined
      ? rules.enabled
      : boolean(body.enabled, "enabled"),
    star_range_ends: body.star_range_ends === undefined
      ? rules.star_range_ends
      : parseStarRangeEnds(body.star_range_ends),
    grade_range_ends: body.grade_range_ends === undefined
      ? rules.grade_range_ends
      : parseGradeRangeEnds(body.grade_range_ends),
  };

  const { error } = await context.supabaseAdmin
    .from(TABLES.collegeMedalSettings)
    .upsert({ college_id: collegeId, ...next }, { onConflict: "college_id" });
  if (error) {
    throw new AppError(500, "medal_settings_save_failed", error.message);
  }

  await writeAudit(
    context,
    admin,
    "medals.settings_updated",
    "college",
    collegeId,
    {
      enabled: next.enabled,
    },
  );
  return json(settingsResponse(collegeId, next, false));
}
