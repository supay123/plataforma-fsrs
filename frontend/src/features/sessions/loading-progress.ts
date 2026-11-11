/** Etapas reales de la carga de la práctica: cambian cuando el servidor o el descifrado terminan. */
export type LoadStage = "downloading" | "preparing";
export type SlowNotice = "none" | "slow" | "stuck";

export const SLOW_AFTER_MS = 20_000;
export const STUCK_AFTER_MS = 60_000;

const RANGE: Record<LoadStage, readonly [number, number]> = { downloading: [5, 60], preparing: [60, 95] };
const EASE_MS = 6_000;

export const STAGE_LABEL: Record<LoadStage, string> = {
  downloading: "Descargando tus preguntas…",
  preparing: "Preparando la corrección…",
};

/** Avanza lento dentro de la etapa y nunca la completa por su cuenta: solo un hito real la cierra. */
export function progressFor(stage: LoadStage, stageElapsedMs: number): number {
  const [from, to] = RANGE[stage];
  return from + (to - from) * (1 - Math.exp(-Math.max(0, stageElapsedMs) / EASE_MS));
}

export function slowNotice(elapsedMs: number): SlowNotice {
  if (elapsedMs >= STUCK_AFTER_MS) return "stuck";
  return elapsedMs >= SLOW_AFTER_MS ? "slow" : "none";
}
