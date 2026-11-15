import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import { PracticeMascot } from "../../features/sessions/PracticeMascot";

export { Eyebrow, ProgressBar } from "./ornaments";

// En los portales (`portal:`) los botones tienen el borde inferior grueso del estilo Chancón (`--edge`).
const buttonBase = "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 dark:rounded-lg portal:rounded-xl portal:shadow-[0_3px_0_var(--edge)] portal:duration-100 portal:enabled:active:translate-y-[3px] portal:enabled:active:shadow-none";
/** `size="sm"` para acciones dentro de filas y tarjetas de lista (más compacto). */
export function Button({ className, variant = "primary", size = "md", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "warning" | "ghost"; size?: "md" | "sm" }) {
  return <button className={clsx(buttonBase, size === "sm" ? "min-h-8 px-3 py-1 portal:px-3.5" : "min-h-10 px-4 py-2 portal:px-5", {
    "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 portal:bg-primary portal:hover:bg-primary portal:text-on-primary portal:[--edge:var(--c-primary-strong)] portal:hover:brightness-105": variant === "primary",
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5 portal:border-2 portal:border-line-strong portal:bg-transparent portal:text-fg portal:[--edge:var(--c-line-strong)] portal:hover:bg-sunken": variant === "secondary",
    "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600/90 dark:hover:bg-rose-500 portal:bg-danger portal:hover:bg-danger portal:text-on-danger portal:[--edge:var(--c-danger-strong)] portal:hover:brightness-105": variant === "danger",
    "bg-amber-600 text-white hover:bg-amber-700 dark:bg-yellow-400 dark:text-slate-950 dark:hover:bg-yellow-300 portal:bg-warning portal:hover:bg-warning portal:text-on-warning portal:[--edge:var(--c-warning-strong)] portal:hover:brightness-105": variant === "warning",
    "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 portal:text-fg-muted portal:[--edge:transparent] portal:hover:bg-sunken portal:hover:text-fg": variant === "ghost",
  }, className)} {...props} />;
}
/** Con `hideLabel` la etiqueta queda solo para lectores de pantalla (el control muestra un placeholder). */
export function Field({ label, error, hint, hideLabel, children }: { label: string; error?: string; hint?: ReactNode; hideLabel?: boolean; children: ReactNode }) {
  return <label className="grid content-start gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 portal:text-fg"><span className={clsx(hideLabel && "sr-only")}>{label}</span>{children}{hint && <span className="text-xs font-normal text-slate-500 dark:text-slate-400 portal:text-fg-faint">{hint}</span>}{error && <span className="text-xs text-rose-600 dark:text-rose-400 portal:text-danger-text">{error}</span>}</label>;
}
// En los portales los campos van sobre `sunken` con el texto del fondo nav (así se leen aunque el campo esté sobre la página).
const control = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:rounded-lg dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20 dark:[&>option]:bg-slate-900 portal:rounded-xl portal:border-2 portal:border-line-strong portal:bg-sunken portal:text-on-blocks portal:placeholder:text-fg-faint portal:focus:border-primary portal:focus:ring-0 portal:[&>option]:bg-blocks";
// Variante "soft": campos con fondo suave y placeholder, sin etiqueta visible.
// Tamaño y peso van con `!` porque `font: inherit` de styles.css (sin capa) gana a las utilidades.
const softControl = "min-h-12 w-full rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-base! font-normal! text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:rounded-lg dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:bg-white/[0.06] dark:focus:ring-emerald-400/20 dark:[&>option]:bg-slate-900 portal:rounded-xl portal:border-2 portal:border-line-strong portal:bg-sunken portal:text-on-blocks portal:placeholder:text-fg-faint portal:focus:border-primary portal:focus:bg-sunken portal:focus:ring-0 portal:[&>option]:bg-blocks";
interface ControlProps { variant?: "default" | "soft"; /** Ícono a la izquierda del control. */ icon?: ReactNode }
const controlClass = ({ variant, icon }: ControlProps, ...extra: Array<string | false | undefined>) =>
  clsx(variant === "soft" ? softControl : control, icon && "peer pl-11", ...extra);
// El ícono va después del control para poder resaltarlo con `peer-focus`.
const ControlIcon = ({ icon }: { icon: ReactNode }) =>
  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-slate-500 peer-focus:text-indigo-600 dark:peer-focus:text-emerald-400 portal:peer-focus:text-primary-text">{icon}</span>;
function WithIcon({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return icon ? <span className="relative block">{children}<ControlIcon icon={icon} /></span> : children;
}
export function Input({ variant, icon, ...props }: InputHTMLAttributes<HTMLInputElement> & ControlProps) { return <WithIcon icon={icon}><input {...props} className={controlClass({ variant, icon }, props.className)} /></WithIcon>; }
/** Campo de contraseña con un botón para mostrar u ocultar lo escrito. */
export function PasswordInput({ className, variant, icon, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & ControlProps) {
  const [visible, setVisible] = useState(false);
  return <span className="relative block">
    <input {...props} type={visible ? "text" : "password"} className={controlClass({ variant, icon }, "pr-11", className)} />
    {icon && <ControlIcon icon={icon} />}
    <button type="button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-500 hover:text-slate-800 dark:rounded-r-lg dark:hover:text-slate-200 portal:rounded-r-xl portal:hover:text-fg" onClick={() => setVisible((current) => !current)}>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </span>;
}
export function Select({ variant, icon, ...props }: SelectHTMLAttributes<HTMLSelectElement> & ControlProps) { return <WithIcon icon={icon}><select {...props} className={controlClass({ variant, icon }, props.className)} /></WithIcon>; }
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={clsx(control, props.className)} />; }
export function Card({ children, className, glow = false }: { children: ReactNode; className?: string; glow?: boolean }) {
  const hasBg = className?.includes("bg-");
  const hasBorder = className?.includes("border-");
  return (
    <section
      className={clsx(
        "relative rounded-2xl p-5 shadow-sm dark:rounded-xl portal:rounded-2xl portal:border-2 portal:bg-blocks portal:text-on-blocks portal:shadow-[0_4px_0_var(--c-line)]",
        !hasBorder && "border border-slate-200 dark:border-white/10 portal:border-line",
        !hasBg && "bg-white dark:bg-slate-900",
        glow && "portal:border-primary/60",
        className
      )}
    >
      {children}
    </section>
  );
}
/** `className` permite quitar el margen inferior (`mb-0! portal:mb-0!`) cuando la página ya separa sus bloques con `gap`. */
export function PageHeader({ title, description, actions, className }: { title: string; description?: string; actions?: ReactNode; className?: string }) {
  return <header className={clsx("mb-6 portal:mb-8", className)}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50 portal:text-3xl portal:tracking-normal portal:text-fg portal:type-display md:portal:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 portal:text-base portal:text-fg-muted">{description}</p>}
      </div>
      {actions}
    </div>
  </header>;
}
export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) { return <div role="alert" className={clsx("rounded-xl border p-3 text-sm portal:border-2", tone === "error" && "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300 portal:border-danger portal:bg-danger-soft portal:text-danger-text", tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300 portal:border-success portal:bg-success-soft portal:text-success-text", tone === "info" && "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 portal:border-line-strong portal:bg-sunken portal:text-fg")}>{children}</div>; }
export function Spinner() { return <div role="status" className="mx-auto my-12 h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 dark:border-white/10 dark:border-t-emerald-400 portal:border-line portal:border-t-primary"><span className="sr-only">Cargando</span></div>; }
/** `mascot`: la mascota dormida sobre el texto (solo si la pantalla no tiene otra mascota). */
export function EmptyState({ children, mascot = false }: { children: ReactNode; mascot?: boolean }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-white/15 dark:text-slate-400 portal:border-2 portal:border-line-strong portal:text-fg-muted">
    {mascot && <PracticeMascot event="sleep" size={72} className="mx-auto mb-3" />}
    {children}
  </div>;
}
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) { return <span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold portal:rounded-lg", tone === "neutral" && "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300 portal:bg-sunken portal:text-fg-muted", tone === "success" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300 portal:bg-success-soft portal:text-success-text", tone === "warning" && "bg-amber-100 text-amber-700 dark:bg-yellow-400/10 dark:text-yellow-300 portal:bg-warning-soft portal:text-warning-text", tone === "danger" && "bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300 portal:bg-danger-soft portal:text-danger-text")}>{children}</span>; }
