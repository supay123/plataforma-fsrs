import { Check, Sprout, Trees, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { PLAN, SEMESTER_PLAN, formatSoles, type PlanId } from "../../config/business";

const semesterMonthly = SEMESTER_PLAN.priceSoles / SEMESTER_PLAN.months;
const semesterSavings = PLAN.priceSoles * SEMESTER_PLAN.months - SEMESTER_PLAN.priceSoles;

interface PlanCardProps {
  plan: PlanId;
  icon: LucideIcon;
  name: string;
  tagline: string;
  price: number;
  billing: string;
  /** Formas de pago, bajo el botón. */
  methods: string;
  badge?: string;
  featuresTitle: string;
  features: string[];
}

function PlanCard({ plan, icon: Icon, name, tagline, price, billing, methods, badge, featuresTitle, features }: PlanCardProps) {
  return <article className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900 text-left">
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <Icon className="text-slate-200" size={40} strokeWidth={1.25} />
        {badge && <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-indigo-300">{badge}</span>}
      </div>
      <h2 className="mt-4 text-2xl font-bold">{name}</h2>
      <p className="text-sm text-slate-300">{tagline}</p>
      <p className="mt-4 flex items-center gap-3"><strong className="text-4xl font-bold tracking-tight">{formatSoles(price)}</strong><span className="text-xs leading-4 text-slate-400">por mes<br />{billing}</span></p>
      <Link to={`/estudiante/sign-up?plan=${plan}`} className="mt-5 flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-500">Elegir {name}</Link>
      <p className="mt-2 text-center text-xs text-slate-400">Sin renovación automática · {methods}</p>
    </div>
    <div className="flex-1 border-t border-slate-800 px-6 py-5">
      <h3 className="text-sm font-semibold text-slate-200">{featuresTitle}</h3>
      <ul className="mt-3 grid gap-2 text-sm text-slate-300">{features.map((feature) => <li key={feature} className="flex gap-2.5"><Check className="mt-0.5 shrink-0 text-slate-400" size={14} />{feature}</li>)}</ul>
    </div>
  </article>;
}

/** Tarjetas de los dos planes, cada una con su botón al registro con el plan elegido. */
export function PlanCards({ className }: { className?: string }) {
  return <div className={`mx-auto grid max-w-4xl gap-6 md:grid-cols-2 ${className ?? ""}`}>
    <PlanCard plan={PLAN.id} icon={Sprout} name={PLAN.name} tagline="Paga mes a mes" price={PLAN.priceSoles} billing="pago mensual" methods="Pago con QR" featuresTitle="Todo incluido:" features={PLAN.features} />
    <PlanCard plan={SEMESTER_PLAN.id} icon={Trees} name={SEMESTER_PLAN.name} tagline="Prepárate todo el ciclo y ahorra" price={semesterMonthly} billing={`${formatSoles(SEMESTER_PLAN.priceSoles)} cada ${SEMESTER_PLAN.months} meses`} methods="Pago con QR o código" badge={`Ahorras ${formatSoles(semesterSavings)}`} featuresTitle={`Todo lo del ${PLAN.name}, y además:`} features={[
      `${formatSoles(semesterSavings)} menos que pagar mes a mes`,
      `Un solo pago por ${SEMESTER_PLAN.months} meses`,
      "Precio fijo durante todo el periodo",
    ]} />
  </div>;
}
