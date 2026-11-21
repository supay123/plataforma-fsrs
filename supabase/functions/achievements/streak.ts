import { requireProfile } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import { addDays, computeStreak, limaCalendarDay } from "../_shared/streak.ts";
import type { EdgeContext } from "../_shared/types.ts";

const RECENT_DAYS = 30;

/**
 * Racha del estudiante: días seguidos hasta hoy (viva si solo falta hoy), mejor
 * racha y los días activos de los últimos 30 días, con el día de Lima.
 */
export async function getStreak(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"], true);
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.studentActivityDays)
    .select("activity_date")
    .eq("student_id", student.id);
  if (error) throw new AppError(500, "streak_failed", error.message);

  const today = limaCalendarDay(new Date());
  const activeDays = (data ?? []).map((row) => row.activity_date);
  const firstRecentDay = addDays(today, -(RECENT_DAYS - 1));
  return json({
    ...computeStreak(activeDays, today),
    today,
    recent_active_days: activeDays.filter((day) => day >= firstRecentDay)
      .sort(),
  });
}
