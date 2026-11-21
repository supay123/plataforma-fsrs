/** Montos de xp de un colegio (sin la fórmula de nivel). */
export interface XpAmounts {
  xp_per_correct: number;
  streak_3_bonus: number;
  streak_7_bonus: number;
  streak_20_bonus: number;
}

/** Lo que gana el estudiante en una sesión, con su desglose. */
export interface SessionXp {
  total: number;
  correct_xp: number;
  /** Bonos de racha cobrados: aciertos seguidos y xp del bono. */
  streak_bonuses: Array<{ streak: number; xp: number }>;
}

/** Resultado de otorgar el xp: nivel antes y después, y el costo de cada paso. */
export interface XpAward {
  xp_gained: number;
  level_before: number;
  xp_before: number;
  level: number;
  xp: number;
  thresholds: number[];
}
