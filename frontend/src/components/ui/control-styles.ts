import clsx from "clsx";
import type { ReactNode } from "react";

// En los portales los campos van sobre `sunken` con el texto del fondo nav (así se leen aunque el campo esté sobre la página).
export const control = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:rounded-lg dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20 dark:[&>option]:bg-slate-900 portal:rounded-xl portal:border-2 portal:border-line-strong portal:bg-sunken portal:text-on-blocks portal:placeholder:text-fg-faint portal:focus:border-primary portal:focus:ring-0 portal:[&>option]:bg-blocks";
// Variante "soft": campos con fondo suave y placeholder, sin etiqueta visible.
// Tamaño y peso van con `!` porque `font: inherit` de styles.css (sin capa) gana a las utilidades.
export const softControl = "min-h-12 w-full rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-base! font-normal! text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:rounded-lg dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:bg-white/[0.06] dark:focus:ring-emerald-400/20 dark:[&>option]:bg-slate-900 portal:rounded-xl portal:border-2 portal:border-line-strong portal:bg-sunken portal:text-on-blocks portal:placeholder:text-fg-faint portal:focus:border-primary portal:focus:bg-sunken portal:focus:ring-0 portal:[&>option]:bg-blocks";
export interface ControlProps { variant?: "default" | "soft"; /** Ícono a la izquierda del control. */ icon?: ReactNode }
export const controlClass = ({ variant, icon }: ControlProps, ...extra: Array<string | false | undefined>) =>
  clsx(variant === "soft" ? softControl : control, icon && "peer pl-11", ...extra);
// El ícono va después del control para poder resaltarlo con `peer-focus`.
