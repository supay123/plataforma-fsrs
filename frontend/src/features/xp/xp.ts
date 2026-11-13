import type { XpAward, XpRules } from "../../types/contracts";

/** Aciertos seguidos que dan bono de racha (se cobra una sola vez por racha). */
export const STREAK_MILESTONES = [3, 7, 20] as const;

/** Texto de una racha: "Tres seguidas", "Siete seguidas", "Veinte seguidas". */
export function streakLabel(streak: number): string {
  const words: Record<number, string> = { 3: "Tres", 7: "Siete", 20: "Veinte" };
  return `${words[streak] ?? streak} seguidas`;
}

export function streakBonus(streak: number, rules: XpRules): number {
  if (streak === 3) return rules.streak_3_bonus;
  if (streak === 7) return rules.streak_7_bonus;
  if (streak === 20) return rules.streak_20_bonus;
  return 0;
}

/**
 * Vista previa del xp de un acierto durante la sesión. Es solo informativa: el
 * xp oficial lo calcula el servidor al cerrar la sesión con las mismas reglas.
 * `streak` son los aciertos seguidos incluyendo este.
 */
export function answerXp(streak: number, rules: XpRules): { base: number; bonus: number; streak: number } {
  return { base: rules.xp_per_correct, bonus: streakBonus(streak, rules), streak };
}

/** Aciertos seguidos al final de la lista (true = acierto, false = fallo). */
export function trailingStreak(results: boolean[]): number {
  let streak = 0;
  for (let i = results.length - 1; i >= 0 && results[i]; i -= 1) streak += 1;
  return streak;
}

export interface LevelSegment {
  /** Nivel que muestra la barra durante este tramo. */
  level: number;
  /** Relleno inicial y final de la barra (0 a 1). */
  from: number;
  to: number;
  /** Si al llenarse la barra el estudiante sube de nivel. */
  levelUp: boolean;
}

/** Tramos de la animación de la barra: uno por cada nivel que cruza más el final. */
export function buildLevelSegments(award: Pick<XpAward, "level_before" | "xp_before" | "xp" | "thresholds">): LevelSegment[] {
  const last = award.thresholds.length - 1;
  return award.thresholds.map((need, index) => ({
    level: award.level_before + index,
    from: index === 0 ? Math.min(1, award.xp_before / need) : 0,
    to: index === last ? Math.min(1, award.xp / need) : 1,
    levelUp: index < last,
  }));
}
