import type { SessionXp, XpAmounts } from "./interfaces/xp.interfaces.ts";

/**
 * Calcula el xp de una sesión a partir de sus respuestas en orden de
 * aparición. Cada acierto da xp_per_correct; el bono de racha se cobra una sola
 * vez en el acierto 3, 7 y 20 seguidos (no se repite en los siguientes). Un
 * fallo reinicia la racha.
 */
export function computeSessionXp(
  correctness: boolean[],
  amounts: XpAmounts,
): SessionXp {
  const bonusByStreak = new Map([
    [3, amounts.streak_3_bonus],
    [7, amounts.streak_7_bonus],
    [20, amounts.streak_20_bonus],
  ]);
  let streak = 0;
  let correctXp = 0;
  const streakBonuses: SessionXp["streak_bonuses"] = [];
  for (const isCorrect of correctness) {
    if (!isCorrect) {
      streak = 0;
      continue;
    }
    streak += 1;
    correctXp += amounts.xp_per_correct;
    const bonus = bonusByStreak.get(streak);
    if (bonus !== undefined) streakBonuses.push({ streak, xp: bonus });
  }
  const bonusXp = streakBonuses.reduce((sum, entry) => sum + entry.xp, 0);
  return {
    total: correctXp + bonusXp,
    correct_xp: correctXp,
    streak_bonuses: streakBonuses,
  };
}
