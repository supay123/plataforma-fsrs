import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, KeyRound, LoaderCircle, MessageCircle, Smartphone, User } from "lucide-react";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Field, Input, Select } from "../../components/ui";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import { BUSINESS, formatSoles, type Plan, type PlanId } from "../../config/business";
import { normalizeError, type AppError } from "../../lib/api/errors";
import { isValidIdentityDocument, normalizeIdentityDocument } from "../registration/rules";
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
  firstName: z.string().trim().min(1, "Ingresa el nombre del titular del Yape.").max(50, "Máximo 50 caracteres."),
  lastName: z.string().trim().min(1, "Ingresa el apellido del titular del Yape.").max(50, "Máximo 50 caracteres."),
  documentType: z.enum(["DNI", "CE"]),
  documentNumber: z.string(),
}).superRefine((values, context) => {
  if (!isValidIdentityDocument(values.documentType, values.documentNumber)) {
    context.addIssue({
      code: "custom",
      path: ["documentNumber"],
      message: values.documentType === "DNI" ? "El DNI tiene 8 dígitos." : "El carné de extranjería tiene de 9 a 12 letras o números.",
    });
  }
});
type Values = z.infer<typeof schema>;

const PAYER_DOCUMENT_TYPES = [{ value: "DNI", label: "DNI" }, { value: "CE", label: "Carné de extranjería" }] as const;

type PaymentMethod = "yape" | "whatsapp";
const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string }> = [{ id: "yape", label: "Yape" }, { id: "whatsapp", label: "WhatsApp" }];

/** Motivos de rechazo de Mercado Pago (status_detail de la orden) con una salida clara. */
const REJECTIONS: Record<string, string> = {
  bad_filled_card_data: "El celular o el código de aprobación no son correctos. Revisa tu celular y genera un código nuevo en Yape.",
  invalid_card_token: "El código de aprobación ya se usó o venció. Genera uno nuevo en Yape.",
  insufficient_amount: "No tienes saldo suficiente en Yape, o el monto supera el límite de tu Yape.",
  amount_limit_exceeded: "El monto supera el límite de tu Yape. Revisa tu límite en la app o usa otro Yape.",
  max_attempts_exceeded: "Superaste los intentos permitidos. Espera un momento e inténtalo otra vez.",
  high_risk: "Mercado Pago no pudo aprobar este pago por seguridad. Escríbenos por WhatsApp y te ayudamos a activar tu plan.",
  required_call_for_authorize: "Yape no autorizó el pago. Revisa tu app de Yape e inténtalo otra vez.",
  rejected_by_issuer: "Yape rechazó el pago. Revisa tu app de Yape e inténtalo otra vez, o usa otro Yape.",
  card_disabled: "Tu Yape no está habilitado para este pago. Revisa tu app de Yape o usa otro Yape.",
  processing_error: "Mercado Pago tuvo un error al procesar el pago. Escríbenos por WhatsApp y te ayudamos a activar tu plan.",
};

// Un nuevo intento no los resuelve (y repetirlos puede empeorar el riesgo): se abre el contacto por WhatsApp en vez del formulario.
const REJECTIONS_FOR_SUPPORT = new Set(["high_risk", "processing_error"]);

function rejectionMessage(detail: string | null) {
  return (detail && REJECTIONS[detail]) ?? "El pago fue rechazado. Revisa tus datos e inténtalo otra vez.";
}

function WhatsAppLink({ children, className, href = `https://wa.me/${BUSINESS.whatsapp}` }: { children: string; className?: string; href?: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className={clsx(className, "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 font-semibold text-white hover:bg-indigo-500 dark:rounded-lg dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 portal:rounded-xl portal:bg-primary portal:text-on-primary portal:shadow-[0_4px_0_var(--c-primary-strong)] portal:hover:bg-primary portal:hover:brightness-105")}><MessageCircle size={18} />{children}</a>;
}

/** Flotante y de aspecto neutro para que no se confunda con el botón de pagar. En móvil sube sobre la barra inferior del portal. */
function FloatingPaymentHelp({ highlighted }: { highlighted: boolean }) {
  return <a href={BUSINESS.whatsappShortLink} target="_blank" rel="noreferrer"
    className={clsx("fixed left-4 bottom-20 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-b-4 border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-lg hover:bg-slate-50 md:bottom-4 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 portal:border-line portal:bg-blocks portal:text-on-blocks", highlighted && "motion-safe:animate-pop")}>
    <MessageCircle size={18} aria-hidden />¿Problemas para pagar?
  </a>;
}

/** Indicaciones para encontrar el código de aprobación en la app de Yape. */
const TUTORIAL_STEPS = [
  {
    title: "Tu celular de Yape",
    content: <>
      <ol className="grid list-decimal gap-1 pl-5">
        <li>Escribe el número de celular con el que usas Yape: <strong>9 dígitos</strong>, sin espacios.</li>
        <li>Es el mismo número que aparece en tu app de Yape.</li>
      </ol>
      <img src="/image/nro-yape.webp" alt="Formulario de pago con el campo del número de celular de Yape señalado" className="mx-auto max-h-64 w-auto rounded-2xl" />
    </>,
  },
  {
    title: "El código de aprobación",
    content: <>
      <ol className="grid list-decimal gap-1 pl-5">
        <li>Abre tu app de Yape y entra a <strong>Aprobar compras</strong>.</li>
        <li>En <strong>Código de aprobación</strong> verás 6 dígitos. Tócalo para copiarlo.</li>
        <li>Vuelve aquí, escríbelo y paga antes de que termine el contador.</li>
      </ol>
      <img src="/image/codigo-yape.webp" alt="Pantalla Aprobar compras de Yape con el código de aprobación de 6 dígitos" className="mx-auto max-h-64 w-auto rounded-2xl" />
      <p className="text-xs text-slate-500 dark:text-slate-400 portal:text-fg-faint">No compartas este código con nadie: escríbelo solo en este formulario.</p>
    </>,
  },
  {
    title: "Los datos de quien paga",
    content: <>
      <ol className="grid list-decimal gap-1 pl-5">
        <li>Escribe el <strong>nombre</strong>, el <strong>apellido</strong> y el <strong>DNI</strong> de la persona dueña del Yape, la que aprueba el pago.</li>
        <li>Si pagas con el Yape de un familiar, usa los datos de esa persona.</li>
        <li>Si el titular es extranjero, elige <strong>Carné de extranjería</strong> en el tipo de documento.</li>
      </ol>
      <img src="/image/llenar-datos-pagante.webp" alt="Formulario de pago con los datos del titular completados y el botón Pagar señalado" className="mx-auto max-h-64 w-auto rounded-2xl" />
      <p className="text-xs text-slate-500 dark:text-slate-400 portal:text-fg-faint">Estos datos solo se envían a Mercado Pago para proteger el pago. Chancón no los guarda.</p>
    </>,
  },
];

/** Guía de tres pasos dentro de un modal para completar el formulario de pago. */
function PaymentTutorial({ onFinish }: { onFinish: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = TUTORIAL_STEPS[stepIndex];
  return <div className="grid gap-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 portal:text-fg-faint">Paso {stepIndex + 1} de {TUTORIAL_STEPS.length}</p>
    <h3 className="font-bold text-slate-950 dark:text-slate-50 portal:text-fg">{step.title}</h3>
    <div className="grid gap-3">{step.content}</div>
    <div className="flex justify-between gap-3">
      <Button type="button" variant="secondary" size="sm" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => index - 1)}>Anterior</Button>
      {stepIndex === TUTORIAL_STEPS.length - 1
        ? <Button type="button" size="sm" onClick={onFinish}>Finalizar</Button>
        : <Button type="button" variant="secondary" size="sm" onClick={() => setStepIndex((index) => index + 1)}>Siguiente</Button>}
    </div>
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
  const [method, setMethod] = useState<PaymentMethod>("yape");
  const inProcess = payment?.status === "pending" || payment?.status === "processing";
  const tracked = useQuery({
    queryKey: ["plan-payment-status", payment?.payment_id],
    queryFn: () => fetchStatus(payment!.payment_id),
    enabled: inProcess,
    refetchInterval: (query) => ["pending", "processing"].includes(query.state.data?.status ?? "pending") ? POLL_MS : false,
  });
  const [dismissedPaymentId, setDismissedPaymentId] = useState<string | null>(null);
  const current = tracked.data?.payment_id === payment?.payment_id ? tracked.data ?? payment : payment;
  const status = current?.status;

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { phone: "", otp: "", firstName: "", lastName: "", documentType: "DNI", documentNumber: "" } });

  // Cuenta cada pago rechazado y cada error al pagar; al llegar a 3 abre el modal con el contacto.
  const [failedAttempts, setFailedAttempts] = useState(0);
  const countedFailedPayments = useRef(new Set<string>());
  const registerFailedAttempt = useCallback(() => setFailedAttempts((count) => count + 1), []);

  useEffect(() => {
    if (!current || (status !== "failed" && status !== "cancelled")) return;
    if (countedFailedPayments.current.has(current.payment_id)) return;
    countedFailedPayments.current.add(current.payment_id);
    if (current.status_detail && REJECTIONS_FOR_SUPPORT.has(current.status_detail)) {
      modal.info({
        title: "Necesitamos ayudarte con tu pago",
        confirmLabel: "Cerrar",
        body: <div className="grid gap-4">
          <p>No pudimos completar este pago. Escríbenos por WhatsApp y te ayudamos a activar tu plan.</p>
          <WhatsAppLink href={BUSINESS.whatsappShortLink}>Escribir por WhatsApp</WhatsAppLink>
        </div>,
      });
      return;
    }
    registerFailedAttempt();
  }, [current, status, registerFailedAttempt, modal]);

  useEffect(() => {
    if (failedAttempts !== FAILED_ATTEMPTS_FOR_HELP) return;
    modal.info({
      title: "¿Tienes problemas para pagar?",
      confirmLabel: "Cerrar",
      body: <div className="grid gap-4">
        <p>Ya van {FAILED_ATTEMPTS_FOR_HELP} intentos sin éxito. Escríbenos por WhatsApp y te ayudamos a activar tu plan.</p>
        <WhatsAppLink href={BUSINESS.whatsappShortLink}>Escribir por WhatsApp</WhatsAppLink>
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
  if ((status === "failed" || status === "cancelled") && current?.status_detail && REJECTIONS_FOR_SUPPORT.has(current.status_detail)) {
    return <div className="grid gap-3">
      <Alert tone="error">{rejectionMessage(current.status_detail)}</Alert>
      <WhatsAppLink href={BUSINESS.whatsappShortLink}>Escribir por WhatsApp</WhatsAppLink>
    </div>;
  }
  if (status === "paid" || status === "processing" || status === "pending") {
    return <p className="flex items-center justify-center gap-2 py-8 text-sm font-semibold text-slate-700 dark:text-slate-200 portal:text-fg">
      {status === "paid" ? <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 portal:text-success-text" size={18} /> : <LoaderCircle className="animate-spin" size={18} />}
      {status === "pending" ? "Mercado Pago está procesando tu pago…" : "Pago recibido. Lo estamos aplicando…"}
    </p>;
  }

  const submit = handleSubmit(async ({ phone, otp, firstName, lastName, documentType, documentNumber }) => {
    try {
      const publicKey = config.data?.public_key ?? (await config.refetch({ throwOnError: true })).data!.public_key;
      const yapePhone = onlyDigits(phone);
      const token = await createYapeToken(publicKey, yapePhone, otp);
      const deviceSessionId = await getDeviceSessionId();
      setPayment(await createPayment(plan.id, {
        token,
        phone: yapePhone,
        payer: { first_name: firstName.trim(), last_name: lastName.trim(), document_type: documentType, document: normalizeIdentityDocument(documentNumber) },
        ...(deviceSessionId && { device_session_id: deviceSessionId }),
      }));
    } catch (reason) {
      registerFailedAttempt();
      toast.error((await normalizeError(reason)).message);
    }
    // El código de aprobación sirve una sola vez.
    setValue("otp", "");
  });

  const whatsappMessage = `Hola, quiero una suscripción por ${plan.months === 1 ? "1 mes" : `${plan.months} meses`}`;

  return <form onSubmit={submit} className="grid gap-4" noValidate>
    {(status === "failed" || status === "cancelled") && current?.payment_id !== dismissedPaymentId && <Alert tone="error" onDismiss={() => setDismissedPaymentId(current?.payment_id ?? null)}>{rejectionMessage(current?.status_detail ?? null)}</Alert>}
    <div role="tablist" aria-label="Método de pago" className="flex items-center gap-2 border-b-2 border-slate-200 dark:border-white/10 portal:border-line">
      {PAYMENT_METHODS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={method === item.id} onClick={() => setMethod(item.id)}
        className={clsx("-mb-0.5 border-b-2 px-4 py-3 font-semibold transition", method === item.id
          ? "border-indigo-600 text-indigo-700 dark:border-emerald-400 dark:text-emerald-300 portal:border-primary portal:text-primary-text"
          : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 portal:text-fg-muted portal:hover:text-fg")}>{item.label}</button>)}
      {method === "yape" && <img src="/image/yape-logo.svg" alt="Paga con Yape" className="ml-auto h-8 w-auto shrink-0 rounded-lg" />}
    </div>
    {method === "whatsapp" ? <div className="grid gap-3">
      <p className="text-sm text-slate-600 dark:text-slate-300 portal:text-fg-muted">Escríbenos por WhatsApp al <strong className="font-semibold text-slate-950 dark:text-slate-50 portal:text-fg">{BUSINESS.phone}</strong> y te ayudamos a activar tu plan.</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 portal:text-fg-muted">Mensaje: “{whatsappMessage}”</p>
      <WhatsAppLink href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(whatsappMessage)}`}>Escribir por WhatsApp</WhatsAppLink>
    </div> : <>
      <button type="button" className="inline-flex items-center gap-1 justify-self-end text-sm font-semibold text-indigo-600 hover:text-indigo-800 dark:text-emerald-400 dark:hover:text-emerald-300 portal:text-primary-text portal:hover:text-fg underline"
        onClick={() => modal.info({ title: "¿Cómo completo mis datos?", hideConfirm: true, body: (close) => <PaymentTutorial onFinish={close} /> })}>
        <CircleHelp size={16} aria-hidden />Ver tutorial paso a paso
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Celular de Yape" hideLabel error={errors.phone?.message}><Input variant="soft" icon={<Smartphone size={20} />} type="tel" inputMode="numeric" autoComplete="tel" placeholder="Celular de Yape" {...register("phone")} /></Field>
        <Field label="Código de aprobación" hideLabel error={errors.otp?.message}><Input variant="soft" icon={<KeyRound size={20} />} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Código de aprobación" {...register("otp")} /></Field>
        <Field label="Nombre del titular del Yape" hideLabel error={errors.firstName?.message}><Input variant="soft" icon={<User size={20} />} autoComplete="given-name" placeholder="Nombres del titular del Yape" {...register("firstName")} /></Field>
        <Field label="Apellido del titular del Yape" hideLabel error={errors.lastName?.message}><Input variant="soft" autoComplete="family-name" placeholder="Apellidos del titular del Yape" {...register("lastName")} /></Field>
        <div className="grid grid-cols-[8.5rem_1fr] gap-2 sm:col-span-2">
          <Field label="Tipo de documento" hideLabel><Select variant="soft" {...register("documentType")}>{PAYER_DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          <Field label="Número de documento" hideLabel error={errors.documentNumber?.message}><Input variant="soft" autoComplete="off" maxLength={12} placeholder="Nro. de documento del titular" {...register("documentNumber")} /></Field>
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting || config.isPending}>{isSubmitting ? "Procesando pago…" : `Pagar ${formatSoles(plan.priceSoles)} con Yape`}</Button>
      <p className="text-center text-xs text-slate-500 dark:text-slate-400 portal:text-fg-faint">Pago procesado por Mercado Pago. Chancón no guarda tu código.</p>
    </>}
    <FloatingPaymentHelp key={failedAttempts} highlighted={failedAttempts > 0} />
  </form>;
}
