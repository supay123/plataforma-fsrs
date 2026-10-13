// Pagos de planes con Kuti, para el registro y para la renovación. El estado
// que manda es el de Kuti: llega por el webhook firmado o consultándolo
// directamente, y se aplica igual en ambos casos. Aplicar un pago es
// idempotente: un aviso repetido o una consulta en paralelo nunca activan ni
// extienden el acceso dos veces.

import { RPCS, TABLES } from "./database.constants.ts";
import { AppError } from "./errors.ts";
import {
  cancelPayment,
  createCharge,
  getPayment,
  type KutiCustomer,
  kutiMode,
  type KutiPaymentIntent,
  type KutiPaymentStatus,
  registerWebhook,
  simulatePayment,
} from "./kuti.ts";
import { type PlanId, planId, PLANS } from "./plans.ts";
import { activateStudentRegistration } from "./registration-activation.ts";
import type { EdgeContext } from "./types.ts";

type SupabaseAdmin = EdgeContext["supabaseAdmin"];

/** Minutos que dura el QR (y el código) antes de vencer. */
const CHARGE_MINUTES = 30;
/** Un cobro al que le queda menos que esto se reemplaza por uno nuevo. */
const REUSE_MARGIN_MS = 2 * 60_000;

export type PlanPaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "expired"
  | "cancelled";

export interface PlanPayment {
  id: string;
  kuti_payment_intent_id: string;
  livemode: boolean;
  plan: string;
  amount: number;
  registration_id: string | null;
  profile_id: string | null;
  status: PlanPaymentStatus;
  qr_payload: string;
  bank_code: string | null;
  checkout_url: string | null;
  expires_at: string;
  paid_at: string | null;
  applied_at: string | null;
}

const PAYMENT_COLUMNS =
  "id,kuti_payment_intent_id,livemode,plan,amount,registration_id,profile_id,status,qr_payload,bank_code,checkout_url,expires_at,paid_at,applied_at";

const STATUS_FROM_KUTI: Record<KutiPaymentStatus, PlanPaymentStatus> = {
  PENDING: "pending",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

/**
 * Estado que ve quien paga:
 * - paid: el pago ya se aplicó (cuenta creada o plan extendido).
 * - processing: Kuti confirmó el pago y se está aplicando.
 * - needs_support: se pagó, pero ya no existe el registro ni la cuenta; lo
 *   revisa el administrador.
 */
export type PublicPaymentStatus =
  | Exclude<PlanPaymentStatus, "succeeded">
  | "paid"
  | "processing"
  | "needs_support";

export function publicPaymentStatus(
  payment: Pick<
    PlanPayment,
    "status" | "applied_at" | "profile_id" | "registration_id"
  >,
): PublicPaymentStatus {
  if (payment.status !== "succeeded") return payment.status;
  if (payment.applied_at) return "paid";
  return payment.profile_id || payment.registration_id
    ? "processing"
    : "needs_support";
}

/** Lo que recibe el navegador para mostrar el cobro. */
export function paymentResponse(payment: PlanPayment) {
  return {
    payment_id: payment.id,
    plan: payment.plan,
    amount: payment.amount,
    qr_payload: payment.qr_payload,
    bank_code: payment.bank_code,
    checkout_url: payment.checkout_url,
    expires_at: payment.expires_at,
    livemode: payment.livemode,
  };
}

/** Respuesta de la consulta de estado. */
export function statusResponse(payment: PlanPayment) {
  return {
    payment_id: payment.id,
    status: publicPaymentStatus(payment),
    expires_at: payment.expires_at,
  };
}

async function findBy(
  supabaseAdmin: SupabaseAdmin,
  column: "id" | "kuti_payment_intent_id",
  value: string,
): Promise<PlanPayment | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLES.planPayments)
    .select(PAYMENT_COLUMNS)
    .eq(column, value)
    .maybeSingle();
  if (error) throw new AppError(500, "payment_lookup_failed", error.message);
  return data as PlanPayment | null;
}

export function findPayment(supabaseAdmin: SupabaseAdmin, id: string) {
  return findBy(supabaseAdmin, "id", id);
}

export function findPaymentByKutiId(
  supabaseAdmin: SupabaseAdmin,
  kutiPaymentIntentId: string,
) {
  return findBy(supabaseAdmin, "kuti_payment_intent_id", kutiPaymentIntentId);
}

/** Nombres y apellidos para Kuti a partir de un nombre completo. */
export function splitFullName(fullName: string): {
  first_name: string;
  last_name: string;
} {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return { first_name: first ?? fullName, last_name: rest.join(" ") || "-" };
}

export interface PaymentOwner {
  column: "registration_id" | "profile_id";
  id: string;
}

/**
 * Crea el cobro del plan para un registro o un estudiante. Si ya tiene uno
 * vigente del mismo plan lo devuelve; si no, anula los pendientes (así nunca
 * paga dos veces) y crea otro.
 */
export async function createPlanPayment(
  supabaseAdmin: SupabaseAdmin,
  input: {
    owner: PaymentOwner;
    plan: PlanId;
    customer: KutiCustomer;
    email: string | null;
  },
): Promise<PlanPayment> {
  const { data: pending, error: pendingError } = await supabaseAdmin
    .from(TABLES.planPayments)
    .select(PAYMENT_COLUMNS)
    .eq(input.owner.column, input.owner.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (pendingError) {
    throw new AppError(500, "payment_lookup_failed", pendingError.message);
  }

  const reusable = (pending as PlanPayment[]).find((payment) =>
    payment.plan === input.plan &&
    new Date(payment.expires_at).getTime() - Date.now() > REUSE_MARGIN_MS
  );
  if (reusable) return reusable;

  for (const old of pending as PlanPayment[]) {
    try {
      await cancelPayment(old.kuti_payment_intent_id);
      await supabaseAdmin
        .from(TABLES.planPayments)
        .update({ status: "cancelled" })
        .eq("id", old.id)
        .eq("status", "pending");
    } catch (cancelError) {
      // Si ya se pagó o venció, el webhook o la consulta lo actualizan.
      console.error("Could not cancel Kuti payment", old.id, cancelError);
    }
  }

  try {
    await ensureKutiWebhook(supabaseAdmin);
  } catch (webhookError) {
    // Sin webhook el pago igual se confirma consultando a Kuti.
    console.error("Could not register the Kuti webhook", webhookError);
  }

  const paymentId = crypto.randomUUID();
  const plan = PLANS[input.plan];
  const intent = await createCharge({
    reference: paymentId,
    amount: plan.amount,
    description: `${plan.name} - Chancón`,
    expiresAt: new Date(Date.now() + CHARGE_MINUTES * 60_000),
    customer: input.customer,
  });
  const qr = intent.payment_method?.qr;
  if (!qr?.payload) {
    throw new AppError(
      502,
      "payment_provider_error",
      "Kuti did not return a QR code.",
    );
  }

  const { data: payment, error } = await supabaseAdmin
    .from(TABLES.planPayments)
    .insert({
      id: paymentId,
      kuti_payment_intent_id: intent.id,
      livemode: intent.livemode,
      plan: input.plan,
      amount: Number(plan.amount),
      registration_id: input.owner.column === "registration_id"
        ? input.owner.id
        : null,
      profile_id: input.owner.column === "profile_id" ? input.owner.id : null,
      email: input.email,
      qr_payload: qr.payload,
      bank_code: intent.payment_method?.payment_code?.code ?? null,
      checkout_url: intent.checkout_url ?? null,
      expires_at: qr.expires_at,
    })
    .select(PAYMENT_COLUMNS)
    .single();
  if (error) throw new AppError(500, "payment_save_failed", error.message);
  return payment as PlanPayment;
}

/** Aplica un pago confirmado: crea la cuenta del registro o extiende el plan. */
async function applyPayment(
  supabaseAdmin: SupabaseAdmin,
  payment: PlanPayment,
): Promise<void> {
  if (payment.profile_id) {
    const { error } = await supabaseAdmin.rpc(RPCS.applyRenewalPayment, {
      p_payment_id: payment.id,
      p_months: PLANS[planId(payment.plan)].months,
    });
    if (error) {
      throw new AppError(400, "renewal_failed", error.message);
    }
    return;
  }
  await activateStudentRegistration(supabaseAdmin, payment.id);
}

/**
 * Lleva el pago al estado que informa Kuti y, si ya está pagado, lo aplica.
 * Un pago confirmado nunca vuelve atrás; Kuti sí puede pasar un cobro vencido
 * a pagado si el dinero llega tarde.
 */
export async function syncPayment(
  supabaseAdmin: SupabaseAdmin,
  payment: PlanPayment,
  intent: KutiPaymentIntent,
): Promise<PlanPayment> {
  if (intent.id !== payment.kuti_payment_intent_id) {
    throw new AppError(409, "payment_mismatch", "Payment does not match.");
  }
  const status = STATUS_FROM_KUTI[intent.status];
  if (status && status !== payment.status && payment.status !== "succeeded") {
    const { error } = await supabaseAdmin
      .from(TABLES.planPayments)
      .update({
        status,
        paid_at: status === "succeeded"
          ? intent.paid_with?.paid_at ?? new Date().toISOString()
          : null,
      })
      .eq("id", payment.id)
      .neq("status", "succeeded");
    if (error) throw new AppError(500, "payment_update_failed", error.message);
  }

  let current = await findPayment(supabaseAdmin, payment.id) ?? payment;
  if (publicPaymentStatus(current) !== "processing") return current;

  try {
    await applyPayment(supabaseAdmin, current);
  } catch (error) {
    // Si otra petición lo aplicó a la vez, el pago ya figura como aplicado.
    current = await findPayment(supabaseAdmin, payment.id) ?? current;
    if (!current.applied_at) throw error;
  }
  return await findPayment(supabaseAdmin, payment.id) ?? current;
}

/** Forma de pago que se simula: QR o código de pago de servicios. */
export function simulatedMethod(
  value: unknown,
): "INTEROPERABLE_QR" | "BANK_TRANSFER" {
  if (value === undefined || value === "qr") return "INTEROPERABLE_QR";
  if (value === "code") return "BANK_TRANSFER";
  throw new AppError(400, "validation_error", "method must be qr or code.", {
    field: "method",
  });
}

/**
 * Solo modo prueba: Kuti da el cobro por pagado sin dinero real y se aplica
 * en el acto, igual que un pago de verdad.
 */
export async function simulateTestPayment(
  supabaseAdmin: SupabaseAdmin,
  payment: PlanPayment,
  method: "INTEROPERABLE_QR" | "BANK_TRANSFER",
): Promise<PlanPayment> {
  if (payment.livemode) {
    throw new AppError(
      403,
      "test_mode_only",
      "Only test-mode payments can be simulated.",
    );
  }
  if (payment.status === "pending") {
    await simulatePayment(
      payment.kuti_payment_intent_id,
      payment.bank_code ? method : "INTEROPERABLE_QR",
    );
  }
  const intent = await getPayment(payment.kuti_payment_intent_id);
  return await syncPayment(supabaseAdmin, payment, intent);
}

/**
 * Registra el webhook de Kuti la primera vez que se cobra en cada modo y
 * guarda su secreto en Vault. Kuti solo envía avisos a URLs HTTPS: en local
 * no se registra y el estado se consulta directamente.
 */
export async function ensureKutiWebhook(
  supabaseAdmin: SupabaseAdmin,
): Promise<void> {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (!baseUrl?.startsWith("https://")) return;

  const mode = kutiMode();
  const { data: secret, error } = await supabaseAdmin.rpc(
    RPCS.kutiWebhookSecret,
    { p_mode: mode },
  );
  if (error) throw new AppError(500, "webhook_lookup_failed", error.message);
  if (secret) return;

  const signingSecret = await registerWebhook(
    `${baseUrl}/functions/v1/kuti/webhook`,
  );
  const { error: saveError } = await supabaseAdmin.rpc(
    RPCS.saveKutiWebhookSecret,
    { p_mode: mode, p_secret: signingSecret },
  );
  if (saveError) {
    throw new AppError(500, "webhook_save_failed", saveError.message);
  }
}
