/** Zona horaria con la que se define el día calendario de un estudiante. */
export const ACTIVITY_TIME_ZONE = "America/Lima";

const MILLISECONDS_PER_DAY = 86_400_000;

/** Día calendario "YYYY-MM-DD" de un instante en America/Lima. */
export function limaCalendarDay(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ACTIVITY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Suma (o resta) días a un día "YYYY-MM-DD" sin depender de la zona horaria local. */
export function addDays(day: string, amount: number): string {
  const shifted = new Date(
    Date.parse(`${day}T00:00:00Z`) + amount * MILLISECONDS_PER_DAY,
  );
  return shifted.toISOString().slice(0, 10);
}

export interface StreakSummary {
  current_streak: number;
  best_streak: number;
  active_today: boolean;
  last_active_date: string | null;
}

/**
 * Racha a partir de los días activos. La racha actual cuenta los días seguidos
 * que terminan hoy; si hoy aún no hubo actividad pero ayer sí, sigue viva y
 * termina ayer. Los días repetidos o desordenados no alteran el resultado.
 */
export function computeStreak(
  activeDays: readonly string[],
  today: string,
): StreakSummary {
  const days = [...new Set(activeDays)].sort();
  const daySet = new Set(days);

  let bestStreak = 0;
  let run = 0;
  let previousDay: string | null = null;
  for (const day of days) {
    run = previousDay !== null && addDays(previousDay, 1) === day ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previousDay = day;
  }

  const activeToday = daySet.has(today);
  let cursor = activeToday ? today : addDays(today, -1);
  let currentStreak = 0;
  while (daySet.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    current_streak: currentStreak,
    best_streak: bestStreak,
    active_today: activeToday,
    last_active_date: days.at(-1) ?? null,
  };
}
