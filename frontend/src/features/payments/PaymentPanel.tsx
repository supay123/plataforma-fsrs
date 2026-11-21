import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, KeyRound, LoaderCircle, MessageCircle, Smartphone } from "lucide-react";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Field, Input } from "../../components/ui";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import { BUSINESS, formatSoles, type Plan, type PlanId } from "../../config/business";
import { normalizeError, type AppError } from "../../lib/api/errors";
import { getPaymentConfig, type PlanPaymentState, type YapePayment } from "./api";
import { createYapeToken, getDeviceSessionId, loadDeviceSessionScript } from "./yape";

function onlyDigits(phone: string) {
  return phone.replace(/\D/g, "").replace(/^51(?=\d{9}$)/, "");
}

// Al fallar este número de intentos seguidos se ofrece el contacto por WhatsApp en un modal.
const FAILED_ATTEMPTS_FOR_HELP = 3;

// Cada cuánto se pregunta si ya se aplicó un pago en proceso.
const POLL_MS = 4000;

// Los celulares de prueba de Mercado Pago (111111111…) no empiezan con 9.
const schema = z.object({
  phone: z.string().refine((value) => /^\d{9}$/.test(onlyDigits(value)), "Ingresa el celular de tu Yape, 9 dígitos."),
  otp: z.string().trim().regex(/^\d{6}$/, "El código de aprobación tiene 6 dígitos."),
});
type Values = z.infer<typeof schema>;

/** Motivos de rechazo de Mercado Pago (status_detail de la orden) con una salida clara. */
const REJECTIONS: Record<string, string> = {
  bad_filled_card_data: "El celular o el código de aprobación no son correctos. Revisa tu celular y genera un código nuevo en Yape.",
  invalid_card_token: "El código de aprobación ya se usó o venció. Genera uno nuevo en Yape.",
  insufficient_amount: "No tienes saldo suficiente en Yape, o el monto supera el límite de tu Yape.",
  max_attempts_exceeded: "Superaste los intentos permitidos. Espera un momento e inténtalo otra vez.",
  cc_rejected_high_risk: "Mercado Pago no pudo aprobar este pago por seguridad. Prueba con el Yape de otra persona o escríbenos por WhatsApp y te ayudamos.",
  required_call_for_authorize: "Yape no autorizó el pago. Revisa tu app de Yape e inténtalo otra vez.",
};

function rejectionMessage(detail: string | null) {
  return (detail && REJECTIONS[detail]) ?? "El pago fue rechazado. Revisa tus datos e inténtalo otra vez.";
}

function WhatsAppLink({ children, className }: { children: string; className?: string }) {
  return <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer" className={clsx(className, "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 font-semibold text-white hover:bg-indigo-500 dark:rounded-lg dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 portal:rounded-xl portal:bg-primary portal:text-on-primary portal:shadow-[0_4px_0_var(--c-primary-strong)] portal:hover:bg-primary portal:hover:brightness-105")}><MessageCircle size={18} />{children}</a>;
}

/** Flotante y de aspecto neutro para que no se confunda con el botón de pagar. En móvil sube sobre la barra inferior del portal. */
function FloatingPaymentHelp({ highlighted }: { highlighted: boolean }) {
  return <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer"
    className={clsx("fixed left-4 bottom-20 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-b-4 border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-lg hover:bg-slate-50 md:bottom-4 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 portal:border-line portal:bg-blocks portal:text-on-blocks", highlighted && "motion-safe:animate-pop")}>
    <MessageCircle size={18} aria-hidden />¿Problemas para pagar?
  </a>;
}

/** Indicaciones para encontrar el código de aprobación en la app de Yape. */
function ApprovalCodeHelp() {
  return <div className="grid gap-4">
    <ol className="grid list-decimal gap-1 pl-5">
      <li>Abre tu app de Yape y entra a <strong>Aprobar compras</strong>.</li>
      <li>En <strong>Código de aprobación</strong> verás 6 dígitos. Tócalo para copiarlo.</li>
      <li>Vuelve aquí, escríbelo junto con tu celular y paga antes de que termine el contador.</li>
    </ol>
    <img src="/image/codigo-yape.webp" alt="Pantalla Aprobar compras de Yape con el código de aprobación de 6 dígitos" className="mx-auto max-h-80 w-auto rounded-2xl" />
    <p className="text-xs text-slate-500 dark:text-slate-400 portal:text-fg-faint">No compartas este código con nadie: escríbelo solo en este formulario.</p>
  </div>;
}

interface PaymentPanelProps {
  plan: Plan;
  /** Cobra el plan con el token de Yape y su celular (registro o renovación). */
  createPayment: (plan: PlanId, yape: YapePayment) => Promise<PlanPaymentState>;
  fetchStatus: (paymentId: string) => Promise<PlanPaymentState>;
  /** Se llama una vez, cuando el pago ya se aplicó. */
  onPaid: () => void;
  /** Texto extra cuando el pago en línea aún no está configurado. */
  unavailableNote?: string;
}

/**
 * Pago de un plan con Yape a través de Mercado Pago: pide el celular y el
 * código de aprobación de la app de Yape, cobra y espera a que se aplique.
 */
export function PaymentPanel({ plan, createPayment, fetchStatus, onPaid, unavailableNote }: PaymentPanelProps) {
  const toast = useToast();
  const modal = useModal();
  const config = useQuery({ queryKey: ["payment-config"], queryFn: getPaymentConfig, retry: false, staleTime: Infinity, refetchOnWindowFocus: false });
  const [payment, setPayment] = useState<PlanPaymentState | null>(null);
  const inProcess = payment?.status === "pending" || payment?.status === "processing";
  const tracked = useQuery({
    queryKey: ["plan-payment-status", payment?.payment_id],
    queryFn: () => fetchStatus(payment!.payment_id),
    enabled: inProcess,
    refetchInterval: (query) => ["pending", "processing"].includes(query.state.data?.status ?? "pending") ? POLL_MS : false,
  });
  const current = tracked.data?.payment_id === payment?.payment_id ? tracked.data ?? payment : payment;
  const status = current?.status;

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { phone: "", otp: "" } });

  // Cuenta cada pago rechazado y cada error al pagar; al llegar a 3 abre el modal con el contacto.
  const [failedAttempts, setFailedAttempts] = useState(0);
  const countedFailedPayments = useRef(new Set<string>());
  const registerFailedAttempt = useCallback(() => setFailedAttempts((count) => count + 1), []);

  useEffect(() => {
    if (!current || (status !== "failed" && status !== "cancelled")) return;
    if (countedFailedPayments.current.has(current.payment_id)) return;
    countedFailedPayments.current.add(current.payment_id);
    registerFailedAttempt();
  }, [current, status, registerFailedAttempt]);

  useEffect(() => {
    if (failedAttempts !== FAILED_ATTEMPTS_FOR_HELP) return;
    modal.info({
      title: "¿Tienes problemas para pagar?",
      confirmLabel: "Cerrar",
      body: <div className="grid gap-4">
        <p>Ya van {FAILED_ATTEMPTS_FOR_HELP} intentos sin éxito. Escríbenos por WhatsApp y te ayudamos a activar tu plan.</p>
        <WhatsAppLink>Escribir por WhatsApp</WhatsAppLink>
      </div>,
    });
  }, [failedAttempts, modal]);

  // El script de seguridad de Mercado Pago necesita unos segundos para identificar el dispositivo.
  useEffect(() => { loadDeviceSessionScript(); }, []);

  const paidHandler = useRef(onPaid);
  useEffect(() => { paidHandler.current = onPaid; }, [onPaid]);
  useEffect(() => { if (status === "paid") paidHandler.current(); }, [status]);

  const configError = config.error as AppError | null;
  if (configError?.code === "payments_unavailable") {
    return <div className="grid gap-4">
      <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50 portal:text-fg">Muy pronto podrás completar el pago aquí</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 portal:text-fg-muted">Estamos terminando el pago en línea con Yape. Mientras tanto, escríbenos y te ayudamos a activar tu {plan.name.toLowerCase()}.</p>
      <WhatsAppLink>Escribir por WhatsApp</WhatsAppLink>
      {unavailableNote && <p className="text-xs text-slate-500 dark:text-slate-400 portal:text-fg-faint">{unavailableNote}</p>}
    </div>;
  }

  if (status === "needs_support") {
    return <div className="grid gap-3">
      <Alert tone="error">Recibimos tu pago, pero no pudimos aplicarlo. Escríbenos y lo resolvemos.</Alert>
      <WhatsAppLink>Escribir por WhatsApp</WhatsAppLink>
    </div>;
  }
  if (status === "paid" || status === "processing" || status === "pending") {
    return <p className="flex items-center justify-center gap-2 py-8 text-sm font-semibold text-slate-700 dark:text-slate-200 portal:text-fg">
      {status === "paid" ? <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 portal:text-success-text" size={18} /> : <LoaderCircle className="animate-spin" size={18} />}
      {status === "pending" ? "Mercado Pago está procesando tu pago…" : "Pago recibido. Lo estamos aplicando…"}
    </p>;
  }

  const submit = handleSubmit(async ({ phone, otp }) => {
    try {
      const publicKey = config.data?.public_key ?? (await config.refetch({ throwOnError: true })).data!.public_key;
      const yapePhone = onlyDigits(phone);
      const token = await createYapeToken(publicKey, yapePhone, otp);
      const deviceSessionId = await getDeviceSessionId();
      setPayment(await createPayment(plan.id, { token, phone: yapePhone, ...(deviceSessionId && { device_session_id: deviceSessionId }) }));
    } catch (reason) {
      registerFailedAttempt();
      toast.error((await normalizeError(reason)).message);
    }
    // El código de aprobación sirve una sola vez.
    setValue("otp", "");
  });

  return <form onSubmit={submit} className="grid gap-4" noValidate>
    {(status === "failed" || status === "cancelled") && <Alert tone="error">{rejectionMessage(current?.status_detail ?? null)}</Alert>}
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400 portal:text-fg-muted">Total a pagar · {plan.months} {plan.months === 1 ? "mes" : "meses"} de acceso</p>
        <p className="type-display text-2xl text-slate-950 dark:text-slate-50 portal:text-fg">{formatSoles(plan.priceSoles)}</p>
      </div>
      <img src="/image/yape-logo.svg" alt="Paga con Yape" className="h-11 w-auto shrink-0 rounded-xl" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Celular de Yape" error={errors.phone?.message}><Input icon={<Smartphone size={20} />} type="tel" inputMode="numeric" autoComplete="tel" placeholder="987654321" {...register("phone")} /></Field>
      {/* La ayuda va junto al título del campo, pero fuera del <label> para no volverse su control. */}
      <div className="grid content-start gap-1.5">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span aria-hidden className="font-medium text-slate-700 dark:text-slate-300 portal:text-fg">Código de aprobación</span>
          <button type="button" aria-label="¿Dónde está el código de aprobación?" className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 dark:text-emerald-400 dark:hover:text-emerald-300 portal:text-primary-text portal:hover:text-fg"
            onClick={() => modal.info({ title: "¿Dónde encuentro mi código?", body: <ApprovalCodeHelp /> })}>
            <CircleHelp size={16} aria-hidden />¿Dónde está?
          </button>
        </div>
        <Field label="Código de aprobación" hideLabel error={errors.otp?.message}><Input icon={<KeyRound size={20} />} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" {...register("otp")} /></Field>
      </div>
    </div>
    <Button type="submit" disabled={isSubmitting || config.isPending}>{isSubmitting ? "Procesando pago…" : `Pagar ${formatSoles(plan.priceSoles)} con Yape`}</Button>
    <FloatingPaymentHelp key={failedAttempts} highlighted={failedAttempts > 0} />
    <p className="text-center text-xs text-slate-500 dark:text-slate-400 portal:text-fg-faint">Pago procesado por Mercado Pago. Chancón no guarda tu código.</p>
  </form>;
}
