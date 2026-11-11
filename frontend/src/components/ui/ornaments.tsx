import clsx from "clsx";
import type { ReactNode } from "react";

// Ornamentos del estilo 1.5 (portales). El dorado va solo aquí: esquinas, rombos, líneas y etiquetas.

/** Las cuatro esquinas doradas de 10 px. Solo se ven dentro de un portal (`.portal`). */
export function Corners() {
  const corner = "absolute hidden h-2.5 w-2.5 border-ornament portal:block";
  return <>
    <span aria-hidden className={clsx(corner, "-left-px -top-px border-l border-t")} />
    <span aria-hidden className={clsx(corner, "-right-px -top-px border-r border-t")} />
    <span aria-hidden className={clsx(corner, "-bottom-px -left-px border-b border-l")} />
    <span aria-hidden className={clsx(corner, "-bottom-px -right-px border-b border-r")} />
  </>;
}

/**
 * Tarjeta del estilo 1.5: degradado, borde recto y esquinas doradas.
 * `glow` añade el brillo jade de los paneles principales; `interactive` resalta al pasar el mouse.
 */
export function Frame({ children, className, glow = false, interactive = false }: { children: ReactNode; className?: string; glow?: boolean; interactive?: boolean }) {
  return <div className={clsx(
    "relative border bg-gradient-to-b from-surface to-surface-deep transition-all duration-200",
    glow ? "border-primary/35 shadow-[0_0_50px_-34px_var(--color-primary)]" : "border-line",
    interactive && "hover:border-primary/45 hover:shadow-[0_0_30px_-16px_var(--color-primary)]",
    className,
  )}>
    <Corners />
    {children}
  </div>;
}

/** Línea con rombo a la izquierda (bajo el título de cada página). */
export function Divider({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("flex items-center gap-2", className)}>
    <span className="h-1.5 w-1.5 rotate-45 bg-ornament" />
    <span className="h-px flex-1 bg-gradient-to-r from-ornament/40 to-transparent" />
  </div>;
}

/** Línea con rombo al centro (menú lateral). */
export function CenteredDivider({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("flex items-center gap-3", className)}>
    <span className="h-px flex-1 bg-gradient-to-r from-transparent to-ornament/40" />
    <span className="h-1.5 w-1.5 rotate-45 bg-ornament" />
    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-ornament/40" />
  </div>;
}

/** Etiqueta pequeña en mayúsculas, dorada, sobre un título o una cifra. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("text-[11px] font-semibold uppercase tracking-[0.18em] text-ornament/75", className)}>{children}</p>;
}

/** Barra de progreso jade (0–100). */
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const percent = Math.max(0, Math.min(100, value));
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} className="h-1 w-full rounded-full bg-track">
    <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light" style={{ width: `${percent}%` }} />
  </div>;
}
