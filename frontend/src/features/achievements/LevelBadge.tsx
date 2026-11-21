const HEXAGON = "M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z";

/** Nivel dentro de un hexágono cuyo borde se llena con el avance (0 a 1) hacia el siguiente nivel. */
export function LevelBadge({ level, progress, size = 120 }: { level: number; progress: number; size?: number }) {
  const filled = Math.max(0, Math.min(1, progress)) * 100;
  return <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Nivel ${level}`} role="img">
    <svg aria-hidden viewBox="0 0 100 100" width={size} height={size} fill="none" strokeLinejoin="round">
      <path d={HEXAGON} className="fill-sunken stroke-line-strong" strokeWidth="6" />
      <path d={HEXAGON} pathLength={100} className="stroke-secondary transition-[stroke-dasharray] duration-700 ease-out" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${filled} 100`} />
    </svg>
    <span className="absolute inset-0 grid place-items-center text-center">
      <span>
        <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">Nivel</span>
        <strong className="type-display block text-4xl leading-none tabular-nums">{level}</strong>
      </span>
    </span>
  </div>;
}
