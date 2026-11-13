import { useEffect, useMemo, useState } from "react";
import { Button, Card, Eyebrow } from "../../components/ui";
import type { XpAward } from "../../types/contracts";
import { buildLevelSegments, streakLabel } from "./xp";
import { prefersReducedMotion, useCountUp } from "./use-count-up";

const START_DELAY_MS = 900;
const FILL_MS = 800;
const LEVEL_UP_MS = 900;

/** Pantalla de fin de sesión: xp ganado que crece y barra que sube nivel por nivel. */
export function XpResult({ award, onContinue }: { award: XpAward; onContinue: () => void }) {
  const segments = useMemo(() => buildLevelSegments(award), [award]);
  const total = useCountUp(award.xp_gained);
  const reduced = prefersReducedMotion();
  // Con movimiento reducido se muestra directo el estado final, sin animar.
  const shown = reduced ? segments[segments.length - 1]! : segments[0]!;
  const [view, setView] = useState({ level: shown.level, fill: reduced ? shown.to : shown.from, animate: false, pulse: 0 });
  const [done, setDone] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((resolve) => { timers.push(window.setTimeout(resolve, ms)); });
    void (async () => {
      await wait(START_DELAY_MS);
      for (const segment of segments) {
        if (cancelled) return;
        setView((current) => ({ ...current, fill: segment.to, animate: true }));
        await wait(FILL_MS);
        if (cancelled) return;
        if (segment.levelUp) {
          setView((current) => ({ level: segment.level + 1, fill: 0, animate: false, pulse: current.pulse + 1 }));
          await wait(LEVEL_UP_MS);
        }
      }
      if (!cancelled) setDone(true);
    })();
    return () => { cancelled = true; timers.forEach(window.clearTimeout); };
  }, [segments, reduced]);

  const levelsGained = award.level - award.level_before;
  const need = award.thresholds[award.thresholds.length - 1]!;
  return <Card glow className="mx-auto mt-4 max-w-xl text-center sm:mt-10 sm:p-8">
    <Eyebrow>Práctica terminada</Eyebrow>
    <p className="mt-4 font-display text-5xl tabular-nums text-primary-light" aria-label={`${award.xp_gained} xp ganados`}>+{total} xp</p>
    {award.breakdown.streak_bonuses.length > 0 && <ul className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-fg-muted">
      {award.breakdown.streak_bonuses.map((bonus) => <li key={bonus.streak} className="border border-line-strong px-2 py-1">
        {streakLabel(bonus.streak)}: <span className="font-semibold text-primary-light">+{bonus.xp} xp</span>
      </li>)}
    </ul>}
    <div className="mt-8 flex items-baseline justify-between text-left">
      <p className="text-fg-muted">Nivel <span key={view.pulse} className="inline-block font-display text-3xl text-primary-pale motion-safe:animate-pop">{view.level}</span></p>
      {done && <p className="text-sm tabular-nums text-fg-muted">{award.xp} / {need} xp</p>}
    </div>
    <div role="progressbar" aria-label="Progreso de nivel" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.fill * 100)} className="mt-2 h-3 w-full bg-track">
      <div className={`h-full bg-gradient-to-r from-primary to-primary-light ${view.animate ? "transition-[width] duration-[800ms] ease-out motion-reduce:transition-none" : ""}`} style={{ width: `${view.fill * 100}%` }} />
    </div>
    <p className="mt-3 min-h-5 text-sm text-primary-light" aria-live="polite">
      {done && levelsGained > 0 && (levelsGained === 1 ? "¡Subiste de nivel!" : `¡Subiste ${levelsGained} niveles!`)}
    </p>
    <div className="mt-6 flex justify-center">
      <Button onClick={onContinue}>Ver revisión</Button>
    </div>
  </Card>;
}
