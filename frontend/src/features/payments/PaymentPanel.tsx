import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { CheckCircle2, Copy, Download, ExternalLink, LoaderCircle, MessageCircle, QrCode, RefreshCw, Ticket } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "../../components/ui";
import { useToast } from "../../components/ui/use-toast";
import { BUSINESS, formatSoles, type Plan, type PlanId } from "../../config/business";
import { normalizeError, type AppError } from "../../lib/api/errors";
import { secondsUntil, useNow } from "../../lib/use-now";
import type { PlanPayment, PlanPaymentState, SimulatedMethod } from "./api";

// Cada cuánto se pregunta si ya se pagó.
const POLL_MS = 4000;

const linkButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50";

function WhatsAppLink({ children }: { children: string }) {
  return <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 font-semibold text-white hover:bg-indigo-500"><MessageCircle size={18} />{children}</a>;
}

function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

interface PaymentPanelProps {
  plan: Plan;
  /** Quién paga (registro o estudiante); junto con el plan identifica el cobro. */
  payerKey: string;
  createPayment: (plan: PlanId) => Promise<PlanPayment>;
  fetchStatus: (paymentId: string) => Promise<PlanPaymentState>;
  /** Solo modo prueba: da el cobro por pagado sin dinero real. */
  simulatePayment: (paymentId: string, method: SimulatedMethod) => Promise<PlanPaymentState>;
  /** Se llama una vez, cuando el pago ya se aplicó. */
  onPaid: () => void;
  /** Texto extra cuando el pago en línea aún no está configurado. */
  unavailableNote?: string;
}

/**
 * Cobro de un plan con Kuti: muestra el QR (y el código de pago de servicios
 * si el plan lo permite) y espera a que Kuti confirme el pago.
 */
export function PaymentPanel({ plan, payerKey, createPayment, fetchStatus, simulatePayment, onPaid, unavailableNote }: PaymentPanelProps) {
  const now = useNow();
  const toast = useToast();
  const qrRef = useRef<HTMLCanvasElement>(null);
  // Cada intento pide un cobro nuevo; al cambiar de plan también, y el anterior se anula.
  const [attempt, setAttempt] = useState(0);
  const [method, setMethod] = useState<SimulatedMethod>("qr");
  const [copied, setCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const created = useQuery({
    queryKey: ["plan-payment", payerKey, plan.id, attempt],
    queryFn: () => createPayment(plan.id),
    retry: false, staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false,
  });
  const payment = created.data ?? null;
  const tracked = useQuery({
    queryKey: ["plan-payment-status", payment?.payment_id],
    queryFn: () => fetchStatus(payment!.payment_id),
    enabled: payment !== null,
    refetchInterval: (query) => ["pending", "processing"].includes(query.state.data?.status ?? "pending") ? POLL_MS : false,
  });
  const status = tracked.data?.payment_id === payment?.payment_id ? tracked.data?.status ?? "pending" : "pending";

  const paidHandler = useRef(onPaid);
  useEffect(() => { paidHandler.current = onPaid; }, [onPaid]);
  useEffect(() => { if (status === "paid") paidHandler.current(); }, [status]);

  const createError = created.error as AppError | null;
  if (createError?.code === "payments_unavailable") {
    return <div className="grid gap-4">
      <h2 className="text-lg font-bold text-slate-950">Muy pronto podrás completar el pago aquí</h2>
      <p className="text-sm text-slate-600">Estamos terminando el pago en línea a través de Kuti. Mientras tanto, escríbenos y te ayudamos a activar tu {plan.name.toLowerCase()}.</p>
      <WhatsAppLink>Escribir por WhatsApp</WhatsAppLink>
      {unavailableNote && <p className="text-xs text-slate-500">{unavailableNote}</p>}
    </div>;
  }

  const generate = () => setAttempt((value) => value + 1);
  const secondsLeft = payment ? secondsUntil(payment.expires_at, now) : 0;
  const expired = status === "expired" || (status === "pending" && payment !== null && secondsLeft === 0);
  const code = method === "code" ? payment?.bank_code ?? null : null;

  const downloadQr = () => {
    const canvas = qrRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `qr-pago-${BUSINESS.brand.toLowerCase()}.png`;
    link.click();
  };
  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
  };
  const simulate = async () => {
    if (!payment) return;
    try {
      setSimulating(true);
      await simulatePayment(payment.payment_id, method);
      await tracked.refetch();
    } catch (reason) { toast.error((await normalizeError(reason)).message); }
    finally { setSimulating(false); }
  };

  return <div className="grid gap-3">
    {payment && !payment.livemode && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Modo prueba: este cobro no mueve dinero real.</p>}
    {createError && <Alert tone="error">{createError.message}</Alert>}

    {status === "needs_support"
      ? <div className="grid gap-3">
        <Alert tone="error">Recibimos tu pago, pero no pudimos aplicarlo. Escríbenos y lo resolvemos.</Alert>
        <WhatsAppLink>Escribir por WhatsApp</WhatsAppLink>
      </div>
      : status === "processing" || status === "paid"
        ? <p className="flex items-center justify-center gap-2 py-8 text-sm font-semibold text-slate-700">{status === "paid" ? <CheckCircle2 className="text-emerald-600" size={18} /> : <LoaderCircle className="animate-spin" size={18} />}Pago recibido. Lo estamos aplicando…</p>
        : expired || status === "failed" || status === "cancelled"
          ? <div className="grid justify-items-center gap-3 py-6 text-center">
            <p className="text-sm text-slate-700">{status === "failed" ? "El pago fue rechazado." : "El cobro venció."} Genera uno nuevo para pagar.</p>
            <Button type="button" className="gap-2" disabled={created.isFetching} onClick={generate}><RefreshCw size={16} />{created.isFetching ? "Generando…" : "Generar otro cobro"}</Button>
          </div>
          : !payment
            ? <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-600">{created.isFetching ? <><LoaderCircle className="animate-spin" size={18} />Generando tu cobro…</> : <Button type="button" onClick={generate}>Reintentar</Button>}</p>
            : <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
              <div className="justify-self-center">
                {code
                  ? <div className="grid w-48 justify-items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Código de pago</span>
                    <span className="font-mono text-2xl font-bold tracking-[0.15em] text-slate-950">{code}</span>
                    <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800" onClick={() => void copyCode()}><Copy size={14} />{copied ? "Copiado" : "Copiar"}</button>
                  </div>
                  : <div className="rounded-2xl border border-slate-200 bg-white p-3"><QRCodeCanvas ref={qrRef} value={payment.qr_payload} size={176} marginSize={1} title="QR de pago" /></div>}
              </div>
              <div className="grid gap-3 text-center sm:text-left">
                <div>
                  <p className="text-sm text-slate-500">Total a pagar · {plan.months} {plan.months === 1 ? "mes" : "meses"} de acceso</p>
                  <p className="text-2xl font-bold text-slate-950">{formatSoles(plan.priceSoles)}</p>
                </div>
                {payment.bank_code && <div role="tablist" aria-label="Forma de pago" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                  {([["qr", "QR", QrCode], ["code", "Código de pago", Ticket]] as const).map(([value, label, Icon]) =>
                    <button key={value} type="button" role="tab" aria-selected={method === value} onClick={() => setMethod(value)}
                      className={clsx("inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition", method === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900")}>
                      <Icon size={16} />{label}
                    </button>)}
                </div>}
                {code
                  ? <p className="text-sm text-slate-600">En la app de tu banco o de Yape entra a <strong>Pago de servicios</strong>, busca <strong>KUTI</strong> e ingresa el código.</p>
                  : <p className="text-sm text-slate-600">Escanéalo con Yape, Plin o la billetera de tu banco.<span className="sm:hidden"> Si pagas desde este celular, descárgalo y súbelo desde la galería de tu app.</span></p>}
                <p className="flex items-center justify-center gap-2 text-xs text-slate-500 sm:justify-start"><LoaderCircle className="animate-spin" size={14} />Esperando tu pago · vence en <strong className="tabular-nums text-slate-700">{formatCountdown(secondsLeft)}</strong></p>
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  {!code && <Button type="button" variant="secondary" className="gap-2" onClick={downloadQr}><Download size={16} />Descargar QR</Button>}
                  {payment.checkout_url && <a href={payment.checkout_url} target="_blank" rel="noreferrer" className={linkButton}><ExternalLink size={16} />Página de pago</a>}
                  {!payment.livemode && <Button type="button" className="gap-2" disabled={simulating} onClick={() => void simulate()}><CheckCircle2 size={16} />{simulating ? "Simulando…" : "Simular pago"}</Button>}
                </div>
              </div>
            </div>}
  </div>;
}
