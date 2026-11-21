import clsx from "clsx";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../lib/theme/theme-context";

/** Interruptor día/noche. La elección se guarda en el navegador y sobrevive al cierre de sesión. */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, toggleMode } = useTheme();
  const isNight = mode === "dark";
  const iconCell = "relative z-10 grid h-6 w-6 place-items-center transition-colors";
  return <button type="button" role="switch" aria-checked={isNight} aria-label="Tema oscuro" title={isNight ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} onClick={toggleMode}
    className={clsx("relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-line-strong bg-sunken p-0.5 transition-colors", className)}>
    <span aria-hidden className={clsx("absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-primary transition-transform duration-200", isNight && "translate-x-6")} />
    <span className={clsx(iconCell, isNight ? "text-fg-faint" : "text-on-primary")}><Sun aria-hidden size={14} /></span>
    <span className={clsx(iconCell, isNight ? "text-on-primary" : "text-fg-faint")}><Moon aria-hidden size={14} /></span>
  </button>;
}
