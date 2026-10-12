import type { PlanId } from "../../config/business";
import { invokeFunction } from "../../lib/api/functions";
import { supabase } from "../../lib/supabase/client";

/** Cobro de un plan. El monto lo fija el servidor según el plan. */
export interface PlanPayment {
  payment_id: string;
  plan: PlanId;
  amount: number;
  /** Contenido del QR (EMVCo) que se escanea con Yape, Plin u otra billetera. */
  qr_payload: string;
  /** Código de pago de servicios (solo desde S/ 50, como el plan semestral). */
  bank_code: string | null;
  checkout_url: string | null;
  expires_at: string;
  /** false: cobro de prueba de Kuti, no mueve dinero. */
  livemode: boolean;
}
export type PlanPaymentStatus = "pending" | "processing" | "paid" | "failed" | "expired" | "cancelled" | "needs_support";
export interface PlanPaymentState { payment_id: string; status: PlanPaymentStatus; expires_at: string }
/** Forma de pago que se simula en modo prueba. */
export type SimulatedMethod = "qr" | "code";

/** POST /account/payment: crea (o reutiliza) el cobro para renovar el plan. */
export function createRenewalPayment(plan: PlanId) {
  return invokeFunction<PlanPayment, { plan: PlanId }>("account/payment", { plan });
}

/** GET /account/payment?payment_id=...: estado del pago; al pagarse extiende el plan. */
export function getRenewalPaymentStatus(paymentId: string) {
  return invokeFunction<PlanPaymentState, Record<string, never>>(
    `account/payment?payment_id=${encodeURIComponent(paymentId)}`, {}, { method: "GET" },
  );
}

/** POST /account/payment/simulate: solo modo prueba, da por pagada la renovación. */
export function simulateRenewalPayment(paymentId: string, method: SimulatedMethod) {
  return invokeFunction<PlanPaymentState, { payment_id: string; method: SimulatedMethod }>("account/payment/simulate", { payment_id: paymentId, method });
}

/** Pago confirmado por Kuti que no se pudo aplicar porque ya no existe el registro ni la cuenta. */
export interface PaymentToReview { id: string; email: string | null; plan: PlanId; amount: number; paid_at: string; kuti_payment_intent_id: string; livemode: boolean }

/** Pagos por revisar del administrador (lectura directa con RLS de administrador). */
export async function listPaymentsToReview() {
  const { data, error } = await supabase.from("plan_payments")
    .select("id,email,plan,amount,paid_at,kuti_payment_intent_id,livemode")
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
