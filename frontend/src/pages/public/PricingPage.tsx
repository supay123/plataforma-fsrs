import { Check, LockKeyhole, Sprout, Trees, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicLayout";
import { BUSINESS, PLAN, SEMESTER_PLAN, formatSoles, type PlanId } from "../../config/business";

const semesterMonthly = SEMESTER_PLAN.priceSoles / SEMESTER_PLAN.months;
const semesterSavings = PLAN.priceSoles * SEMESTER_PLAN.months - SEMESTER_PLAN.priceSoles;

const faqs = [
  { question: "¿Cómo se realiza el pago?", answer: `Pagas a través de Kuti escaneando un código QR con Yape, Plin u otra billetera. El ${SEMESTER_PLAN.name} también puedes pagarlo con un código de pago de servicios desde la app de tu banco o de Yape. No hay débito automático: cada pago cubre un mes o seis meses, según el plan que elijas.` },
  { question: "¿Cómo renuevo mi plan?", answer: "Te avisaremos cuando tu plan esté por terminar. Para seguir usando la plataforma vuelves a pagar el plan que prefieras. Si no renuevas, tu acceso termina el último día del periodo pagado." },
  { question: "¿Es seguro pagar aquí?", answer: "Los pagos se procesan con Kuti. Nosotros nunca vemos ni guardamos los datos de tu Yape o de tu billetera." },
];

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
  return <article className="flex flex-col rounded-3xl border border-slate-800 bg-slate-900 text-left">
    <div className="p-8">
      <div className="flex items-start justify-between gap-4">
        <Icon className="text-slate-200" size={52} strokeWidth={1.25} />
        {badge && <span className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold text-indigo-300">{badge}</span>}
      </div>
      <h2 className="mt-6 text-3xl font-bold">{name}</h2>
      <p className="mt-1 text-slate-300">{tagline}</p>
      <p className="mt-6 flex items-center gap-3"><strong className="text-5xl font-bold tracking-tight">{formatSoles(price)}</strong><span className="text-sm leading-5 text-slate-400">por mes<br />{billing}</span></p>
      <Link to={`/estudiante/sign-up?plan=${plan}`} className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-indigo-600 px-4 font-semibold text-slate-950 transition hover:bg-indigo-500">Elegir {name}</Link>
      <p className="mt-3 text-center text-sm text-slate-400">Sin renovación automática · {methods}</p>
    </div>
    <div className="flex-1 border-t border-slate-800 p-8">
      <h3 className="font-semibold text-slate-200">{featuresTitle}</h3>
      <ul className="mt-4 grid gap-3 text-slate-300">{features.map((feature) => <li key={feature} className="flex gap-3"><Check className="mt-1 shrink-0 text-slate-400" size={16} />{feature}</li>)}</ul>
    </div>
  </article>;
}

export function PricingPage() {
  return <PublicPage>
    <section className="px-4 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Practica a tu ritmo con {BUSINESS.brand}</h1>
      <p className="mx-auto mt-4 max-w-2xl text-slate-300">Elige por cuánto tiempo quieres practicar. Sin renovación automática: vuelves a pagar solo si decides seguir.</p>
      <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
        <PlanCard plan={PLAN.id} icon={Sprout} name={PLAN.name} tagline="Paga mes a mes" price={PLAN.priceSoles} billing="pago mensual" methods="Pago con QR" featuresTitle="Todo incluido:" features={PLAN.features} />
        <PlanCard plan={SEMESTER_PLAN.id} icon={Trees} name={SEMESTER_PLAN.name} tagline="Prepárate todo el ciclo y ahorra" price={semesterMonthly} billing={`${formatSoles(SEMESTER_PLAN.priceSoles)} cada ${SEMESTER_PLAN.months} meses`} methods="Pago con QR o código" badge={`Ahorras ${formatSoles(semesterSavings)}`} featuresTitle={`Todo lo del ${PLAN.name}, y además:`} features={[
          `${formatSoles(semesterSavings)} menos que ${SEMESTER_PLAN.months} pagos mensuales`,
          `Un solo pago para ${SEMESTER_PLAN.months} meses de acceso`,
          "Precio fijo durante todo el periodo",
        ]} />
      </div>
      <p className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400"><LockKeyhole size={14} />Pago seguro con Yape, Plin u otra billetera a través de Kuti.</p>
      <p className="mt-2 text-sm text-slate-400">Al pagar aceptas los <Link className="text-indigo-300 hover:text-indigo-200" to="/terminos">términos y condiciones</Link> y la <Link className="text-indigo-300 hover:text-indigo-200" to="/reembolsos">política de reembolsos</Link>.</p>
    </section>
    <section className="mx-auto max-w-3xl px-4 pb-20">
      <h2 className="text-center text-2xl font-bold">Preguntas frecuentes</h2>
      <div className="mt-8 grid gap-3">{faqs.map((faq) => <details key={faq.question} className="group rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <summary className="cursor-pointer list-none font-semibold marker:hidden">{faq.question}</summary>
        <p className="mt-3 text-sm leading-6 text-slate-300">{faq.answer}</p>
      </details>)}</div>
    </section>
  </PublicPage>;
}
