import type { XpRules } from "../../types/contracts";

/** XP que falta para el siguiente nivel. `xp` es el acumulado dentro del nivel actual y `xp_to_next` lo que cuesta pasar de nivel. */
export function xpMissingForNextLevel(state: Pick<XpRules, "xp" | "xp_to_next">): number {
  return Math.max(0, state.xp_to_next - state.xp);
}

/** Avance (0 a 1) dentro del nivel actual. */
export function levelProgress(state: Pick<XpRules, "xp" | "xp_to_next">): number {
  return state.xp_to_next > 0 ? Math.min(1, state.xp / state.xp_to_next) : 0;
}

/** "1 día" / "N días". */
export function daysLabel(days: number): string {
  return `${days} ${days === 1 ? "día" : "días"}`;
}

const WEEKDAY_LABELS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;
const TRACK_LENGTH = 7;

export interface StreakTrackDay { date: string; label: string; done: boolean; isToday: boolean; milestone: 3 | 7 | null }

/**
 * Tramo de 7 días de la racha: los días ya cumplidos del tramo actual y los que faltan, con hitos en el día 3 y el 7.
 * Al completar 7 días empieza otro tramo. Con la racha en 0 el tramo empieza hoy.
 */
export function streakTrack(today: string, currentStreak: number, activeToday: boolean): StreakTrackDay[] {
  const doneDays = currentStreak === 0 ? 0 : ((currentStreak - 1) % TRACK_LENGTH) + 1;
  const [year, month, day] = today.split("-").map(Number) as [number, number, number];
  const lastDoneOffset = activeToday ? 0 : -1;
  const firstOffset = doneDays === 0 ? 0 : lastDoneOffset - (doneDays - 1);
  return Array.from({ length: TRACK_LENGTH }, (_, index) => {
    const moment = new Date(Date.UTC(year, month - 1, day + firstOffset + index));
    const date = moment.toISOString().slice(0, 10);
    return { date, label: WEEKDAY_LABELS[moment.getUTCDay()]!, done: index < doneDays, isToday: date === today, milestone: index === 2 ? 3 : index === 6 ? 7 : null };
  });
}
