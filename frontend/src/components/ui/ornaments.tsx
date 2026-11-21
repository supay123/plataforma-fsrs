import clsx from "clsx";
import type { ReactNode } from "react";

// Detalles del estilo Chancón (portales): el rombo en el color de acento y la barra de progreso.

/** Etiqueta pequeña en mayúsculas con un rombo de acento, sobre un título o una cifra. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted", className)}>
    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rotate-45 bg-secondary" />{children}
  </p>;
}

/** Barra de progreso (0–100). `size="sm"` para tarjetas compactas. */
export function ProgressBar({ value, label, size = "md" }: { value: number; label?: string; size?: "sm" | "md" }) {
  const percent = Math.max(0, Math.min(100, value));
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} className={clsx("w-full overflow-hidden rounded-full bg-sunken", size === "sm" ? "h-1.5" : "h-3")}>
    <div className={clsx("h-full rounded-full transition-[width] duration-500 ease-out bg-primary")} style={{ width: `${percent}%` }} />
  </div>;
}
