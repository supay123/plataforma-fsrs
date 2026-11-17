import { requireProfile } from "../_shared/auth.ts";
import { AppError, json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { optionalUuid } from "../_shared/validation.ts";
import { loadMedalRules, settingsResponse } from "./settings.ts";

/**
 * Configuración de medallas de una institución. Profesor y estudiante reciben
 * la de su colegio; el admin indica la suya con ?college_id=.
 */
export async function getMedalSettings(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const profile = await requireProfile(context, [
    "admin",
    "teacher",
    "student",
  ]);
  const requestedCollegeId = optionalUuid(
    new URL(request.url).searchParams.get("college_id"),
    "college_id",
  );
  const collegeId = profile.role === "admin"
    ? requestedCollegeId
    : profile.college_id;
  if (!collegeId) {
    throw new AppError(
      400,
      "college_required",
      "college_id is required for administrators.",
    );
  }
  const { rules, isDefault } = await loadMedalRules(context, collegeId);
  return json(settingsResponse(collegeId, rules, isDefault));
}
