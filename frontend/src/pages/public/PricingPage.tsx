import { Check, LockKeyhole, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicLayout";
import { BUSINESS, PLAN, formatSoles } from "../../config/business";

const faqs = [
  { question: "¿Cómo se realiza el cobro?", answer: `Pagas con Yape a través de Kuti. Afilias tu Yape una sola vez y cada ${PLAN.period} se debitan ${formatSoles(PLAN.priceSoles)} automáticamente hasta que canceles.` },
  { question: "¿Puedo cancelar cuando quiera?", answer: "Sí. Al cancelar no se realizan más cobros y mantienes el acceso hasta el final del periodo que ya pagaste. No hay reembolsos proporcionales por los días restantes." },
  { question: "¿Es seguro pagar aquí?", answer: "Los pagos se procesan con Kuti. Nosotros nunca vemos ni guardamos tu clave de Yape." },
];

export function PricingPage() {
  return <PublicPage>
    <section className="px-4 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Practica a tu ritmo con {BUSINESS.brand}</h1>
      <p className="mx-auto mt-4 max-w-2xl text-slate-300">Un solo plan con todo incluido. Sin permanencia: cancelas cuando quieras.</p>
      <article className="mx-auto mt-12 max-w-md rounded-3xl border border-indigo-400/60 bg-slate-900 p-8 text-left shadow-2xl shadow-indigo-950">
        <h2 className="text-lg font-semibold text-indigo-300">{PLAN.name}</h2>
        <p className="mt-4 flex items-end gap-2"><strong className="text-5xl font-bold">{formatSoles(PLAN.priceSoles)}</strong><span className="pb-1 text-slate-400">/ {PLAN.period}</span></p>
        <p className="mt-2 text-sm text-slate-400">Débito mensual automático con Yape. Precio en soles.</p>
        <Link to="/suscribirse" className="mt-8 flex min-h-12 items-center justify-center rounded-xl bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-500">Suscribirme</Link>
        <ul className="mt-8 grid gap-3 text-sm text-slate-200">{PLAN.features.map((feature) => <li key={feature} className="flex gap-3"><Check className="mt-0.5 shrink-0 text-indigo-300" size={18} />{feature}</li>)}</ul>
        <p className="mt-8 flex items-center gap-2 border-t border-slate-800 pt-5 text-xs text-slate-400"><LockKeyhole size={14} />Pago seguro con Yape a través de Kuti.</p>
      </article>
      <p className="mt-6 text-sm text-slate-400">Al suscribirte aceptas los <Link className="text-indigo-300 hover:text-indigo-200" to="/terminos">términos y condiciones</Link> y la <Link className="text-indigo-300 hover:text-indigo-200" to="/reembolsos">política de reembolsos</Link>.</p>
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

export function SubscribePage() {
  return <PublicPage>
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Muy pronto podrás suscribirte aquí</h1>
      <p className="mt-4 text-slate-300">Estamos terminando el registro en línea. Mientras tanto, escríbenos y te ayudamos a activar tu {PLAN.name.toLowerCase()}.</p>
      <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-indigo-600 px-6 font-semibold text-white hover:bg-indigo-500"><MessageCircle size={18} />Escribir por WhatsApp</a>
      <p className="mt-6"><Link className="text-sm text-indigo-300 hover:text-indigo-200" to="/precios">← Volver a planes</Link></p>
    </section>
  </PublicPage>;
}
