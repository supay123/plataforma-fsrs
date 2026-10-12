import clsx from "clsx";
import { PLANS, planPriceLabel, type Plan, type PlanId } from "../../config/business";

/** Selector del plan a pagar (mensual o semestral). */
export function PlanPicker({ plan, onChange }: { plan: Plan; onChange: (plan: PlanId) => void }) {
  return <div role="radiogroup" aria-label="Plan" className="grid grid-cols-2 gap-2">
    {PLANS.map((item) => <button key={item.id} type="button" role="radio" aria-checked={item.id === plan.id} onClick={() => onChange(item.id)}
      className={clsx("rounded-xl border px-3 py-2 text-left text-sm transition", item.id === plan.id ? "border-indigo-500 bg-indigo-50 text-indigo-900" : "border-slate-200 text-slate-600 hover:border-slate-300")}>
      <span className="block font-semibold">{item.name}</span>{planPriceLabel(item)}
    </button>)}
  </div>;
}
