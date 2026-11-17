import { Medal } from "lucide-react";
import type { MedalAward } from "./api";
import { MEDAL_NAMES } from "./medals";
import { MedalRulesHelp } from "./MedalRulesHelp";
import { StarSlots } from "./StarSlots";

/** Medalla actual y estrellas de la sesión, junto al xp. No se muestra si el colegio no tiene medallas. */
export function MedalResult({ award }: { award: MedalAward | null | undefined }) {
  if (!award?.enabled) return null;
  const change = award.stars_delta;
  const changedMedal = award.medal !== award.medal_before;
  return <section aria-label="Medalla" className="mt-8 rounded-2xl border-2 border-line bg-sunken p-4 text-left">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Medal aria-hidden size={36} className="shrink-0 text-secondary-text" />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-fg-muted">Tu medalla</p>
          <p className="type-heading truncate text-xl">{MEDAL_NAMES[award.medal]}</p>
        </div>
      </div>
      <p className={`type-display shrink-0 text-2xl tabular-nums ${change > 0 ? "text-success-text" : change < 0 ? "text-danger-text" : "text-fg-muted"}`}
        aria-label={`${change} estrellas`}>{change > 0 ? `+${change}` : change} ★</p>
    </div>
    <p className="mt-2 text-sm text-fg-muted" aria-live="polite">
      {change > 0 ? `Ganaste ${change} ${change === 1 ? "estrella" : "estrellas"}.` : change < 0 ? `Perdiste ${-change} ${change === -1 ? "estrella" : "estrellas"}.` : "Esta práctica no cambió tus estrellas."}
      {" "}Llevas <strong className="text-fg tabular-nums">{award.stars}</strong> en total.
      {changedMedal && <span className="font-semibold text-primary-text"> {award.stars > award.stars_before ? "¡Subiste a" : "Bajaste a"} {MEDAL_NAMES[award.medal]}!</span>}
    </p>
    <div className="mt-3 flex items-center justify-between gap-3 text-sm text-fg-muted">
      <span className="inline-flex items-center gap-2">Este tema <StarSlots best={award.topic_best_stars} /></span>
      <MedalRulesHelp />
    </div>
  </section>;
}
