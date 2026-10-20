import { LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPage } from "../../components/layout/PublicLayout";
import { BUSINESS, SEMESTER_PLAN } from "../../config/business";
import { PlanCards } from "../../features/payments/PlanCards";

const faqs = [
  { question: "¿Cómo se realiza el pago?", answer: `Pagas a través de Kuti escaneando un código QR con Yape, Plin u otra billetera. El ${SEMESTER_PLAN.name} también puedes pagarlo con un código de pago de servicios desde la app de tu banco o de Yape. No hay débito automático: cada pago cubre un mes o seis meses, según el plan que elijas.` },
  { question: "¿Cómo renuevo mi plan?", answer: "Te avisaremos cuando tu plan esté por terminar. Para seguir usando la plataforma vuelves a pagar el plan que prefieras. Si no renuevas, tu acceso termina el último día del periodo pagado." },
  { question: "¿Es seguro pagar aquí?", answer: "Los pagos se procesan con Kuti. Nosotros nunca vemos ni guardamos los datos de tu Yape o de tu billetera." },
];

export function PricingPage() {
  return <PublicPage>
    <section className="px-4 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Practica a tu ritmo con {BUSINESS.brand}</h1>
      <p className="mx-auto mt-4 max-w-2xl text-slate-300">Elige por cuánto tiempo quieres practicar. Sin renovación automática: vuelves a pagar solo si decides seguir.</p>
      <PlanCards className="mt-12" />
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
