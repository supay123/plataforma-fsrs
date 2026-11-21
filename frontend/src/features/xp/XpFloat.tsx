import { streakLabel } from "./xp";

/**
 * Xp ganado por una respuesta, estilo videojuego: aparece sobre las opciones, sube
 * hacia la derecha y se desvanece. La racha sale aparte, como un bono. Con
 * `prefers-reduced-motion` no se anima y queda como texto fijo.
 * Va dentro de un contenedor `relative`; no captura clics.
 */
export function XpFloat({ base, bonus, streak }: { base: number; bonus: number; streak: number }) {
  return <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-2 px-4 pb-2 sm:px-6">
    <p className="type-display text-4xl tabular-nums text-primary [text-shadow:0_0_18px_var(--c-primary)] motion-safe:animate-xp-float">+{base} xp</p>
    {bonus > 0 && <div className="rounded-xl border-2 border-secondary bg-blocks px-3 py-1.5 text-on-blocks shadow-[0_0_28px_-6px_var(--c-secondary)] motion-safe:animate-xp-bonus">
      <p className="type-heading text-xl tabular-nums">{streakLabel(streak)}: +{bonus} xp</p>
    </div>}
  </div>;
}
