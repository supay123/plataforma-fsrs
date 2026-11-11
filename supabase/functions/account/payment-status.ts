import { requireProfile } from "../_shared/auth.ts";
import { AppError, json } from "../_shared/errors.ts";
import {
  findPayment,
  paymentResponse,
  refreshPayment,
} from "../_shared/plan-payments.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";

/**
 * GET /account/payment?payment_id=…
 * Estado de un pago de renovación del propio estudiante. Mientras sigue en
 * proceso se lo pregunta a Mercado Pago y, si ya se pagó, extiende el plan.
 */
export async function paymentStatus(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"]);
  const paymentId = uuid(
    new URL(request.url).searchParams.get("payment_id"),
    "payment_id",
  );
  let payment = await findPayment(context.supabaseAdmin, paymentId);
  if (!payment || payment.profile_id !== student.id) {
    throw new AppError(404, "payment_not_found", "Payment not found.");
  }

  try {
    payment = await refreshPayment(context.supabaseAdmin, payment);
  } catch (error) {
    // La pantalla vuelve a consultar en unos segundos.
    console.error("Could not sync Mercado Pago payment", paymentId, error);
  }
  return json(paymentResponse(payment));
}
