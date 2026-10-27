import clsx from "clsx";
import { PLANS, SEMESTER_PLAN, planPriceLabel, type Plan, type PlanId } from "../../config/business";

/** Selector del plan a pagar (mensual o semestral). */
export function PlanPicker({ plan, onChange }: { plan: Plan; onChange: (plan: PlanId) => void }) {
  return <div role="radiogroup" aria-label="Plan" className="grid grid-cols-2 gap-2">
    {PLANS.map((item) => <button key={item.id} type="button" role="radio" aria-checked={item.id === plan.id} onClick={() => onChange(item.id)}
      className={clsx("rounded-xl border px-3 py-2 text-left text-sm transition", item.id === SEMESTER_PLAN.id
        // El semestral lleva siempre el borde dorado de su tarjeta en el home.
        ? item.id === plan.id ? "border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-400" : "border-amber-300 text-slate-600 hover:border-amber-400"
        : item.id === plan.id ? "border-indigo-500 text-indigo-900 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-400" : "border-slate-300 text-slate-600 hover:border-slate-400")}>
      <span className="block font-semibold">{item.name}</span>{planPriceLabel(item)}
    </button>)}
  </div>;
}
