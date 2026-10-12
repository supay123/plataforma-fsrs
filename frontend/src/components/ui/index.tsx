import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import clsx from "clsx";

export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return <button className={clsx("inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", {
    "bg-indigo-600 text-white hover:bg-indigo-700": variant === "primary",
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50": variant === "secondary",
    "bg-rose-600 text-white hover:bg-rose-700": variant === "danger",
    "text-slate-600 hover:bg-slate-100": variant === "ghost",
  }, className)} {...props} />;
}
/** Con `hideLabel` la etiqueta queda solo para lectores de pantalla (el control muestra un placeholder). */
export function Field({ label, error, hint, hideLabel, children }: { label: string; error?: string; hint?: ReactNode; hideLabel?: boolean; children: ReactNode }) {
  return <label className="grid content-start gap-1.5 text-sm font-medium text-slate-700"><span className={clsx(hideLabel && "sr-only")}>{label}</span>{children}{hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}{error && <span className="text-xs text-rose-600">{error}</span>}</label>;
}
const control = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
// Variante "soft": campos con fondo suave y placeholder, sin etiqueta visible.
// Tamaño y peso van con `!` porque `font: inherit` de styles.css (sin capa) gana a las utilidades.
const softControl = "min-h-12 w-full rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-base! font-normal! text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100";
interface ControlProps { variant?: "default" | "soft"; /** Ícono a la izquierda del control. */ icon?: ReactNode }
const controlClass = ({ variant, icon }: ControlProps, ...extra: Array<string | false | undefined>) =>
  clsx(variant === "soft" ? softControl : control, icon && "peer pl-11", ...extra);
// El ícono va después del control para poder resaltarlo con `peer-focus`.
const ControlIcon = ({ icon }: { icon: ReactNode }) =>
  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-slate-500 peer-focus:text-indigo-600">{icon}</span>;
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
    <button type="button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-500 hover:text-slate-800" onClick={() => setVisible((current) => !current)}>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </span>;
}
export function Select({ variant, icon, ...props }: SelectHTMLAttributes<HTMLSelectElement> & ControlProps) { return <WithIcon icon={icon}><select {...props} className={controlClass({ variant, icon }, props.className)} /></WithIcon>; }
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={clsx(control, props.className)} />; }
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  const hasBg = className?.includes("bg-");
  const hasBorder = className?.includes("border-");
  return (
    <section
      className={clsx(
        "rounded-2xl p-5 shadow-sm",
        !hasBorder && "border border-slate-200",
        !hasBg && "bg-white",
        className
      )}
    >
      {children}
    </section>
  );
}
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) { return <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>{description && <p className="mt-1 text-sm text-slate-600">{description}</p>}</div>{actions}</header>; }
export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) { return <div role="alert" className={clsx("rounded-xl border p-3 text-sm", tone === "error" && "border-rose-200 bg-rose-50 text-rose-800", tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800", tone === "info" && "border-indigo-200 bg-indigo-50 text-indigo-800")}>{children}</div>; }
export function Spinner() { return <div role="status" className="mx-auto my-12 h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"><span className="sr-only">Cargando</span></div>; }
export function EmptyState({ children }: { children: ReactNode }) { return <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">{children}</div>; }
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) { return <span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold", tone === "neutral" && "bg-slate-100 text-slate-700", tone === "success" && "bg-emerald-100 text-emerald-700", tone === "warning" && "bg-amber-100 text-amber-700")}>{children}</span>; }
