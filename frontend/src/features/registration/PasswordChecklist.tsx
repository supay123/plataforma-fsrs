import clsx from "clsx";
import { Check, Circle } from "lucide-react";
import { PASSWORD_MIN_LENGTH, passwordChecks } from "./rules";

/** Reglas de la contraseña, marcadas a medida que se cumplen. */
export function PasswordChecklist({ password }: { password: string }) {
  const checks = passwordChecks(password);
  const items = [
    { met: checks.length, label: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres` },
    { met: checks.lowercase, label: "Al menos una letra minúscula" },
    { met: checks.digit, label: "Al menos un número" },
    { met: checks.uppercase, label: "Al menos una letra mayúscula" },
  ];
  return <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:rounded-lg dark:bg-white/[0.04] dark:text-slate-400 portal:rounded-xl portal:bg-sunken portal:text-fg-muted" aria-live="polite">
    <p className="mb-2 font-medium text-slate-700 dark:text-slate-300 portal:text-fg">Tu contraseña debe tener:</p>
    <ul className="grid gap-1 sm:grid-cols-2">{items.map((item) => <li key={item.label} className={clsx("flex items-center gap-2", item.met && "text-emerald-700 dark:text-emerald-400 portal:text-success-text")}>
      {item.met ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
      {item.label}<span className="sr-only">{item.met ? "(cumplido)" : "(pendiente)"}</span>
    </li>)}</ul>
  </div>;
}
