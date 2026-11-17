import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { parseRankingCategories } from "../_shared/ranking.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { boolean, uuid } from "../_shared/validation.ts";
import type { SaveRankingSettingsBody } from "./interfaces.ts";
import { loadRankingSettings, rankingSettingsResponse } from "./settings.ts";

/**
 * Modifica la configuración del ranking de una institución (solo admin). Los
 * campos que no se envían conservan su valor; sin fila se crea con los valores
 * por defecto más lo enviado.
 */
export async function saveRankingSettings(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const admin = await requireProfile(context, ["admin"]);
  const body = await readJson<SaveRankingSettingsBody>(request);
  const collegeId = uuid(body.college_id, "college_id");

  const { data: college, error: collegeError } = await context.supabaseAdmin
    .from(TABLES.colleges)
    .select("id")
    .eq("id", collegeId)
    .maybeSingle();
  if (collegeError || !college) {
    throw new AppError(404, "college_not_found", "College not found.");
  }

  const { settings } = await loadRankingSettings(context, collegeId);
  const next = {
    enabled: body.enabled === undefined
      ? settings.enabled
      : boolean(body.enabled, "enabled"),
    categories: body.categories === undefined
      ? settings.categories
      : parseRankingCategories(body.categories),
  };

  const { error } = await context.supabaseAdmin
    .from(TABLES.collegeRankingSettings)
    .upsert({ college_id: collegeId, ...next }, { onConflict: "college_id" });
  if (error) {
    throw new AppError(500, "ranking_settings_save_failed", error.message);
  }

  await writeAudit(
    context,
    admin,
    "ranking.settings_updated",
    "college",
    collegeId,
    { enabled: next.enabled, categories: next.categories },
  );
  return json(await rankingSettingsResponse(context, collegeId, next, false));
}
