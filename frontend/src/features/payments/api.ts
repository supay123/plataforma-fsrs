import type { PlanId } from "../../config/business";
import { invokeFunction } from "../../lib/api/functions";
import { supabase } from "../../lib/supabase/client";

/**
 * Estado de un pago de plan. El monto lo fija el servidor según el plan.
 * - paid: ya se aplicó (cuenta creada o plan extendido).
 * - processing: Mercado Pago lo aprobó y se está aplicando.
 * - pending: Mercado Pago todavía lo está procesando.
 * - needs_support: se pagó, pero no se pudo aplicar; lo revisa el administrador.
 */
export interface PlanPaymentState {
  payment_id: string;
  plan: PlanId;
  amount: number;
  status: PlanPaymentStatus;
  /** Motivo de Mercado Pago, por ejemplo al rechazar el pago. */
  status_detail: string | null;
  /** false: pago de prueba, no mueve dinero real. */
  livemode: boolean;
}
export type PlanPaymentStatus = "pending" | "processing" | "paid" | "failed" | "expired" | "cancelled" | "needs_support";

/** GET /public/payment-config: Public Key de Mercado Pago para generar el token de Yape. */
export function getPaymentConfig() {
  return invokeFunction<{ public_key: string }, Record<string, never>>("public/payment-config", {}, { method: "GET" });
}

/** Nombre, apellido y DNI del titular del Yape (quien paga, que puede no ser el estudiante). */
export interface YapePayer { first_name: string; last_name: string; document: string }

/** Token de Yape (de un solo uso), el celular con el que se generó, el titular del Yape y el identificador del dispositivo (antifraude), si se obtuvo. */
export interface YapePayment { token: string; phone: string; payer: YapePayer; device_session_id?: string }

/** POST /account/payment: cobra con Yape la renovación del plan. */
export function createRenewalPayment(plan: PlanId, yape: YapePayment) {
  return invokeFunction<PlanPaymentState, { plan: PlanId } & YapePayment>("account/payment", { plan, ...yape });
}

/** GET /account/payment?payment_id=...: estado del pago; al pagarse extiende el plan. */
export function getRenewalPaymentStatus(paymentId: string) {
  return invokeFunction<PlanPaymentState, Record<string, never>>(
    `account/payment?payment_id=${encodeURIComponent(paymentId)}`, {}, { method: "GET" },
  );
}

/** Pago confirmado que no se pudo aplicar porque ya no existe el registro ni la cuenta. */
export interface PaymentToReview { id: string; email: string | null; plan: PlanId; amount: number; paid_at: string; provider: "kuti" | "mercadopago"; provider_payment_id: string | null; livemode: boolean }

/** Pagos por revisar del administrador (lectura directa con RLS de administrador). */
export async function listPaymentsToReview() {
  const { data, error } = await supabase.from("plan_payments")
    .select("id,email,plan,amount,paid_at,provider,provider_payment_id,livemode")
    .eq("status", "succeeded").is("applied_at", null).is("resolved_at", null)
    .is("profile_id", null).is("registration_id", null)
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return data as PaymentToReview[];
}

export async function resolvePayment(id: string) {
  const { error } = await supabase.from("plan_payments").update({ resolved_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
