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
