import { TABLES } from "../_shared/database.constants.ts";
import { AppError } from "../_shared/errors.ts";
import { DEMO_COLLEGE_CODE } from "../_shared/free-mode.ts";
import type { EdgeContext } from "../_shared/types.ts";

/** Id de la institución demo; su código está reservado y la base impide borrarla. */
export async function demoCollegeId(context: EdgeContext): Promise<string> {
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.colleges)
    .select("id")
    .ilike("code", DEMO_COLLEGE_CODE)
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError(500, "free_mode_lookup_failed", error.message);
  if (!data) {
    throw new AppError(
      503,
      "free_mode_unavailable",
      "The free mode is not available right now.",
    );
  }
  return data.id;
}
