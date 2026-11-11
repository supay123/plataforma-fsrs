import clsx from "clsx";
import { Check, Sparkles, Sprout, Trees, type LucideIcon } from "lucide-react";
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
  /** Tarjeta destacada con borde dorado animado. */
  gold?: boolean;
  featuresTitle: string;
  features: string[];
  /** Beneficios que solo trae este plan, resaltados aparte. */
  extrasTitle?: string;
  extras?: string[];
}

function PlanCard({ plan, icon: Icon, name, tagline, price, billing, methods, badge, gold = false, featuresTitle, features, extrasTitle, extras }: PlanCardProps) {
  const card = <article className={clsx("relative flex flex-col rounded-xl bg-slate-900 text-left text-slate-50", !gold && "border border-white/10")}>
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <Icon className={gold ? "text-amber-400" : "text-emerald-400"} size={40} strokeWidth={1.25} />
        {badge && <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/30">{badge}</span>}
      </div>
      <h2 className="mt-4 text-2xl font-bold">{name}</h2>
      <p className="text-sm text-slate-400">{tagline}</p>
      <p className="mt-4 flex items-center gap-3"><strong className="text-4xl font-bold tracking-tight">{formatSoles(price)}</strong><span className="text-xs leading-4 text-slate-400">por mes<br />{billing}</span></p>
      <Link to={`/estudiante/sign-up?plan=${plan}`} className="relative mt-5 flex min-h-11 items-center justify-center overflow-hidden rounded-lg bg-emerald-500 px-4 font-semibold text-slate-950 transition duration-300 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/30">
        {/* Destello que cruza el botón cada pocos segundos. */}
        <span aria-hidden className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/25 to-transparent motion-safe:animate-shine motion-reduce:hidden" />
        <span className="relative">Elegir {name}</span>
      </Link>
      <p className="mt-2 text-center text-xs text-slate-400">Sin renovación automática · {methods}</p>
    </div>
    <div className="flex-1 rounded-b-xl border-t border-white/10 bg-slate-950/50 px-6 py-5">
      <h3 className="text-sm font-semibold text-slate-100">{featuresTitle}</h3>
      <ul className="mt-3 grid gap-2 text-sm text-slate-300">{features.map((feature) => <li key={feature} className="flex gap-2.5"><Check className={clsx("mt-0.5 shrink-0", gold ? "text-amber-400" : "text-emerald-400")} size={14} />{feature}</li>)}</ul>
      {extras && extras.length > 0 && <div className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-amber-200"><Sparkles size={16} className="text-amber-400" aria-hidden />{extrasTitle}</h3>
        <ul className="mt-3 grid gap-2 text-sm font-medium text-amber-100">{extras.map((extra) => <li key={extra} className="flex gap-2.5"><Check className="mt-0.5 shrink-0 text-amber-400" size={14} strokeWidth={3} />{extra}</li>)}</ul>
      </div>}
    </div>
  </article>;

  const shell = "rounded-xl shadow-2xl shadow-black/50";
  if (!gold) return <div className={shell}>{card}</div>;
  // Borde dorado: un degradado cónico oscuro con dos destellos brillantes gira detrás de la tarjeta
  // y asoma por el margen de 3px; una copia desenfocada detrás proyecta el halo que da vueltas.
  const orbit = <div aria-hidden className="absolute left-1/2 top-1/2 aspect-square w-[250%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,#78350f_0deg,#92400e_120deg,#d97706_160deg,#fcd34d_178deg,#d97706_190deg,#78350f_215deg,#92400e_300deg,#d97706_340deg,#fcd34d_358deg,#78350f_360deg)] motion-safe:animate-orbit" />;
  return <div className={clsx(shell, "relative")}>
    <div aria-hidden className="absolute -inset-1 overflow-hidden rounded-2xl opacity-35 blur-lg">{orbit}</div>
    <div className="relative overflow-hidden rounded-xl p-[3px]">
      {orbit}
      {card}
    </div>
  </div>;
}

/** Tarjetas de los dos planes, cada una con su botón al registro con el plan elegido. */
export function PlanCards({ className }: { className?: string }) {
  return <div className={`mx-auto grid max-w-4xl items-start gap-6 md:grid-cols-2 ${className ?? ""}`}>
    <PlanCard plan={PLAN.id} icon={Sprout} name={PLAN.name} tagline="Paga mes a mes" price={PLAN.priceSoles} billing="pago mensual" methods="Pago con QR" featuresTitle="Todo incluido:" features={PLAN.features} />
    <PlanCard plan={SEMESTER_PLAN.id} icon={Trees} name={SEMESTER_PLAN.name} tagline="Prepárate todo el ciclo y ahorra" price={semesterMonthly} billing={`${formatSoles(SEMESTER_PLAN.priceSoles)} cada ${SEMESTER_PLAN.months} meses`} methods="Pago con QR o código" badge={`Ahorras ${formatSoles(semesterSavings)}`} gold
      featuresTitle={`Todo lo del ${PLAN.name}:`} features={PLAN.features}
      extrasTitle={`Extra solo en el ${SEMESTER_PLAN.name}:`} extras={[
        `${formatSoles(semesterSavings)} menos que pagar mes a mes`,
        `Un solo pago por ${SEMESTER_PLAN.months} meses`,
        "Precio fijo durante todo el periodo",
        "Pago también con código desde la app de tu banco o Yape",
      ]} />
  </div>;
}
