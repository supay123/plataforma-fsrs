// Pagos de planes con Mercado Pago (Yape), para el registro y para la
// renovación. El estado que manda es el de Mercado Pago: llega en la respuesta
// del cobro, por el webhook firmado o consultándolo directamente, y se aplica
// igual en los tres casos. Aplicar un pago es idempotente: un aviso repetido o
// una consulta en paralelo nunca activan ni extienden el acceso dos veces.

import { RPCS, TABLES } from "./database.constants.ts";
import { AppError } from "./errors.ts";
import {
  createYapeOrder,
  getOrder,
  type MercadoPagoOrder,
  type MercadoPagoOrderStatus,
  orderStatusDetail,
} from "./mercadopago.ts";
import { type PlanId, planId, PLANS } from "./plans.ts";
import { activateStudentRegistration } from "./registration-activation.ts";
import type { EdgeContext } from "./types.ts";

type SupabaseAdmin = EdgeContext["supabaseAdmin"];

/** expired solo aparece en cobros antiguos de Kuti. */
export type PlanPaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "expired"
  | "cancelled";

export interface PlanPayment {
  id: string;
  provider: "kuti" | "mercadopago";
  provider_payment_id: string | null;
  livemode: boolean;
  plan: string;
  amount: number;
  registration_id: string | null;
  profile_id: string | null;
  status: PlanPaymentStatus;
  status_detail: string | null;
  paid_at: string | null;
  applied_at: string | null;
}

const PAYMENT_COLUMNS =
  "id,provider,provider_payment_id,livemode,plan,amount,registration_id,profile_id,status,status_detail,paid_at,applied_at";

/**
 * Estados de la orden que cambian el pago. refunded y charged_back solo
 * ocurren después de aprobada y no quitan el acceso: los revisa el
 * administrador desde el panel de Mercado Pago.
 */
const STATUS_FROM_ORDER: Partial<
  Record<MercadoPagoOrderStatus, PlanPaymentStatus>
> = {
  created: "pending",
  processing: "pending",
  action_required: "pending",
  processed: "succeeded",
  failed: "failed",
  canceled: "cancelled",
};

/**
 * Estado que ve quien paga:
 * - paid: el pago ya se aplicó (cuenta creada o plan extendido).
 * - processing: Mercado Pago aprobó el pago y se está aplicando.
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

/** Lo que recibe el navegador al pagar y al consultar el estado. */
export function paymentResponse(payment: PlanPayment) {
  return {
    payment_id: payment.id,
    plan: payment.plan,
    amount: payment.amount,
    status: publicPaymentStatus(payment),
    status_detail: payment.status_detail,
    livemode: payment.livemode,
  };
}

export async function findPayment(
  supabaseAdmin: SupabaseAdmin,
  id: string,
): Promise<PlanPayment | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLES.planPayments)
    .select(PAYMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AppError(500, "payment_lookup_failed", error.message);
  return data as PlanPayment | null;
}

/** Token de Yape que generó el navegador con la Public Key. */
export function yapeToken(value: unknown): string {
  if (typeof value !== "string" || !/^[\w-]{8,255}$/.test(value)) {
    throw new AppError(400, "validation_error", "token is required.", {
      field: "token",
    });
  }
  return value;
}

/** Celular de Yape: 9 dígitos (los de prueba de Mercado Pago empiezan con 1). */
export function yapePhone(value: unknown): string {
  const digits = typeof value === "string"
    ? value.replace(/\D/g, "").replace(/^51(?=\d{9}$)/, "")
    : "";
  if (!/^\d{9}$/.test(digits)) {
    throw new AppError(400, "validation_error", "phone must have 9 digits.", {
      field: "phone",
    });
  }
  return digits;
}

export interface PaymentOwner {
  column: "registration_id" | "profile_id";
  id: string;
}

/**
 * Consulta a Mercado Pago un pago suyo que sigue pendiente y lo actualiza.
 * Los cobros antiguos de Kuti ya no se consultan.
 */
export async function refreshPayment(
  supabaseAdmin: SupabaseAdmin,
  payment: PlanPayment,
): Promise<PlanPayment> {
  const status = publicPaymentStatus(payment);
  if (status !== "pending" && status !== "processing") return payment;
  if (payment.provider !== "mercadopago" || !payment.provider_payment_id) {
    return status === "processing"
      ? await syncPayment(supabaseAdmin, payment, null)
      : payment;
  }
  const remote = await getOrder(payment.provider_payment_id);
  return await syncPayment(supabaseAdmin, payment, remote);
}

/**
 * Cobra el plan con Yape para un registro o un estudiante. La fila se guarda
 * antes de llamar a Mercado Pago, así un pago aprobado nunca queda sin dueño.
 * Si hay un pago anterior todavía en proceso no se cobra otra vez.
 */
export async function createPlanPayment(
  supabaseAdmin: SupabaseAdmin,
  input: {
    owner: PaymentOwner;
    plan: PlanId;
    email: string | null;
    token: string;
    phone: string;
  },
): Promise<PlanPayment> {
  if (!input.email) {
    throw new AppError(
      409,
      "payment_email_required",
      "Add an email to your profile before paying.",
    );
  }

  const { data: pending, error: pendingError } = await supabaseAdmin
    .from(TABLES.planPayments)
    .select(PAYMENT_COLUMNS)
    .eq(input.owner.column, input.owner.id)
    .eq("provider", "mercadopago")
    .eq("status", "pending")
    .not("provider_payment_id", "is", null);
  if (pendingError) {
    throw new AppError(500, "payment_lookup_failed", pendingError.message);
  }
  for (const old of pending as PlanPayment[]) {
    const current = await refreshPayment(supabaseAdmin, old);
    if (current.status === "pending" || current.status === "succeeded") {
      throw new AppError(
        409,
        "payment_in_process",
        "A previous payment is still being processed.",
      );
    }
  }

  const paymentId = crypto.randomUUID();
  const plan = PLANS[input.plan];
  const { data: inserted, error } = await supabaseAdmin
    .from(TABLES.planPayments)
    .insert({
      id: paymentId,
      provider: "mercadopago",
      livemode: false,
      plan: input.plan,
      amount: Number(plan.amount),
      registration_id: input.owner.column === "registration_id"
        ? input.owner.id
        : null,
      profile_id: input.owner.column === "profile_id" ? input.owner.id : null,
      email: input.email,
    })
    .select(PAYMENT_COLUMNS)
    .single();
  if (error) throw new AppError(500, "payment_save_failed", error.message);
  const payment = inserted as PlanPayment;

  let remote: MercadoPagoOrder;
  try {
    remote = await createYapeOrder({
      reference: paymentId,
      amount: plan.amount,
      token: input.token,
      email: input.email,
      phone: input.phone,
    });
  } catch (providerError) {
    // Si de todos modos se cobró, el webhook lo encuentra por la referencia.
    const rejected = providerError instanceof AppError &&
      providerError.code === "payment_rejected";
    const details = rejected
      ? providerError.details as { provider_code?: string } | undefined
      : undefined;
    await supabaseAdmin
      .from(TABLES.planPayments)
      .update({
        status: "failed",
        status_detail: details?.provider_code ?? null,
      })
      .eq("id", paymentId)
      .eq("status", "pending");
    // Un rechazo de Yape no es un error: el navegador explica el motivo.
    if (rejected) return await findPayment(supabaseAdmin, paymentId) ?? payment;
    throw providerError;
  }
  try {
    return await syncPayment(supabaseAdmin, payment, remote);
  } catch (syncError) {
    // Ya se cobró: el navegador sigue consultando el estado y el webhook lo
    // vuelve a aplicar.
    console.error("Could not apply Mercado Pago payment", paymentId, syncError);
    return await findPayment(supabaseAdmin, paymentId) ?? payment;
  }
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
 * Lleva el pago al estado que informa Mercado Pago (si llega) y, si ya está
 * pagado, lo aplica. Un pago confirmado nunca vuelve atrás; un pago marcado
 * como fallido sí pasa a pagado si Mercado Pago lo aprobó.
 */
export async function syncPayment(
  supabaseAdmin: SupabaseAdmin,
  payment: PlanPayment,
  remote: MercadoPagoOrder | null,
): Promise<PlanPayment> {
  if (remote && payment.status !== "succeeded") {
    if (remote.external_reference !== payment.id) {
      throw new AppError(409, "payment_mismatch", "Payment does not match.");
    }
    const status = STATUS_FROM_ORDER[remote.status] ?? payment.status;
    const { error } = await supabaseAdmin
      .from(TABLES.planPayments)
      .update({
        provider_payment_id: remote.id,
        // La orden no dice si es de prueba; solo el aviso del webhook.
        livemode: remote.live_mode ?? payment.livemode,
        status,
        status_detail: orderStatusDetail(remote),
        paid_at: status === "succeeded"
          ? remote.last_updated_date ?? new Date().toISOString()
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
