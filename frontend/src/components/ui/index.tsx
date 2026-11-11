import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import { Corners, Divider } from "./ornaments";

export { CenteredDivider, Corners, Divider, Eyebrow, Frame, ProgressBar } from "./ornaments";

export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "warning" | "ghost" }) {
  return <button className={clsx("inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 dark:rounded-lg portal:rounded-none", {
    "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 portal:border portal:border-primary/60 portal:bg-primary/10 portal:text-primary-pale portal:hover:bg-primary/20 portal:hover:shadow-[0_0_20px_-8px_var(--color-primary)]": variant === "primary",
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5 portal:border-line-strong portal:text-fg portal:hover:bg-white/[0.04]": variant === "secondary",
    "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600/90 dark:hover:bg-rose-500 portal:border portal:border-danger/60 portal:bg-danger/10 portal:text-danger-light portal:hover:bg-danger/20": variant === "danger",
    "bg-amber-600 text-white hover:bg-amber-700 dark:bg-yellow-400 dark:text-slate-950 dark:hover:bg-yellow-300 portal:border portal:border-warning/60 portal:bg-warning/10 portal:text-warning portal:hover:bg-warning/20": variant === "warning",
    "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 portal:text-fg-muted portal:hover:bg-white/[0.04] portal:hover:text-fg-strong": variant === "ghost",
  }, className)} {...props} />;
}
/** Con `hideLabel` la etiqueta queda solo para lectores de pantalla (el control muestra un placeholder). */
export function Field({ label, error, hint, hideLabel, children }: { label: string; error?: string; hint?: ReactNode; hideLabel?: boolean; children: ReactNode }) {
  return <label className="grid content-start gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 portal:text-fg"><span className={clsx(hideLabel && "sr-only")}>{label}</span>{children}{hint && <span className="text-xs font-normal text-slate-500 dark:text-slate-400 portal:text-fg-faint">{hint}</span>}{error && <span className="text-xs text-rose-600 dark:text-rose-400 portal:text-danger-light">{error}</span>}</label>;
}
const control = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:rounded-lg dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20 dark:[&>option]:bg-slate-900 portal:rounded-none portal:border-line-strong portal:bg-surface-deep portal:text-fg-strong portal:placeholder:text-fg-faint portal:focus:border-primary portal:focus:ring-primary/20 portal:[&>option]:bg-surface-deep";
// Variante "soft": campos con fondo suave y placeholder, sin etiqueta visible.
// Tamaño y peso van con `!` porque `font: inherit` de styles.css (sin capa) gana a las utilidades.
const softControl = "min-h-12 w-full rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-base! font-normal! text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:rounded-lg dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:bg-white/[0.06] dark:focus:ring-emerald-400/20 dark:[&>option]:bg-slate-900 portal:rounded-none portal:border-line-strong portal:bg-surface-deep portal:text-fg-strong portal:placeholder:text-fg-faint portal:focus:border-primary portal:focus:bg-surface-deep portal:focus:ring-primary/20 portal:[&>option]:bg-surface-deep";
interface ControlProps { variant?: "default" | "soft"; /** Ícono a la izquierda del control. */ icon?: ReactNode }
const controlClass = ({ variant, icon }: ControlProps, ...extra: Array<string | false | undefined>) =>
  clsx(variant === "soft" ? softControl : control, icon && "peer pl-11", ...extra);
// El ícono va después del control para poder resaltarlo con `peer-focus`.
const ControlIcon = ({ icon }: { icon: ReactNode }) =>
  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-slate-500 peer-focus:text-indigo-600 dark:peer-focus:text-emerald-400 portal:peer-focus:text-primary-light">{icon}</span>;
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
    <button type="button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-500 hover:text-slate-800 dark:rounded-r-lg dark:hover:text-slate-200 portal:rounded-none portal:hover:text-fg-strong" onClick={() => setVisible((current) => !current)}>
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
        "relative rounded-2xl p-5 shadow-sm dark:rounded-xl portal:rounded-none portal:bg-gradient-to-b portal:from-surface portal:to-surface-deep portal:shadow-none",
        !hasBorder && "border border-slate-200 dark:border-white/10 portal:border-line",
        !hasBg && "bg-white dark:bg-slate-900",
        glow && "portal:border-primary/35 portal:shadow-[0_0_50px_-34px_var(--color-primary)]",
        className
      )}
    >
      <Corners />
      {children}
    </section>
  );
}
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <header className="mb-6 portal:mb-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50 portal:font-display portal:text-3xl portal:font-normal portal:tracking-wide portal:text-primary-pale md:portal:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 portal:text-base portal:text-fg-muted">{description}</p>}
      </div>
      {actions}
    </div>
    <div className="hidden portal:block"><Divider className="mt-5 max-w-xs" /></div>
  </header>;
}
export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) { return <div role="alert" className={clsx("rounded-xl border p-3 text-sm portal:rounded-none", tone === "error" && "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300 portal:border-danger/40 portal:bg-danger/10 portal:text-danger-light", tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300 portal:border-success/40 portal:bg-success/10 portal:text-success-light", tone === "info" && "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 portal:border-line-strong portal:bg-white/[0.03] portal:text-fg")}>{children}</div>; }
export function Spinner() { return <div role="status" className="mx-auto my-12 h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 dark:border-white/10 dark:border-t-emerald-400 portal:border-line portal:border-t-primary-light"><span className="sr-only">Cargando</span></div>; }
export function EmptyState({ children }: { children: ReactNode }) { return <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-white/15 dark:text-slate-400 portal:rounded-none portal:border-line-strong portal:text-fg-muted">{children}</div>; }
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) { return <span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold portal:rounded-none portal:border", tone === "neutral" && "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300 portal:border-line-strong portal:bg-transparent portal:text-fg-muted", tone === "success" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300 portal:border-success/40 portal:bg-success/10 portal:text-success-light", tone === "warning" && "bg-amber-100 text-amber-700 dark:bg-yellow-400/10 dark:text-yellow-300 portal:border-warning/40 portal:bg-warning/10 portal:text-warning", tone === "danger" && "bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300 portal:border-danger/40 portal:bg-danger/10 portal:text-danger-light")}>{children}</span>; }
