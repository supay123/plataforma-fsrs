import clsx from "clsx";
import { PLANS, SEMESTER_PLAN, planPriceLabel, type Plan, type PlanId } from "../../config/business";

/** Selector del plan a pagar (mensual o semestral). */
export function PlanPicker({ plan, onChange }: { plan: Plan; onChange: (plan: PlanId) => void }) {
  return <div role="radiogroup" aria-label="Plan" className="grid grid-cols-2 gap-2">
    {PLANS.map((item) => <button key={item.id} type="button" role="radio" aria-checked={item.id === plan.id} onClick={() => onChange(item.id)}
      className={clsx("rounded-xl border px-3 py-2 text-left text-sm transition dark:rounded-lg portal:rounded-xl portal:border-2", item.id === SEMESTER_PLAN.id
        // El semestral lleva siempre el borde dorado de su tarjeta en el home.
        ? item.id === plan.id ? "border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-400 dark:border-amber-400 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/40 portal:border-secondary portal:bg-secondary-soft portal:text-secondary-text portal:ring-0" : "border-amber-300 text-slate-600 hover:border-amber-400 dark:border-amber-400/40 dark:text-slate-300 dark:hover:border-amber-400/70 portal:border-secondary/50 portal:text-fg-muted portal:hover:border-secondary"
        : item.id === plan.id ? "border-indigo-500 text-indigo-900 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-400 dark:border-emerald-400 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/40 portal:border-primary portal:bg-primary-soft portal:text-primary-text portal:ring-0" : "border-slate-300 text-slate-600 hover:border-slate-400 dark:border-white/15 dark:text-slate-300 dark:hover:border-white/30 portal:border-line-strong portal:text-fg-muted portal:hover:border-primary")}>
      <span className="block font-semibold">{item.name}</span>{planPriceLabel(item)}
    </button>)}
  </div>;
}
