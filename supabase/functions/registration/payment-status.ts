import { AppError, json } from "../_shared/errors.ts";
import { getPayment } from "../_shared/kuti.ts";
import {
  findPayment,
  publicPaymentStatus,
  statusResponse,
  syncPayment,
} from "../_shared/plan-payments.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";

/**
 * GET /registration/payment?payment_id=…
 * Estado del pago del registro. Mientras está pendiente se lo pregunta a Kuti,
 * así se confirma aunque el webhook no llegue (por ejemplo, en local) y, si ya
 * se pagó, se activa la cuenta.
 */
export async function paymentStatus(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const paymentId = uuid(
    new URL(request.url).searchParams.get("payment_id"),
    "payment_id",
  );
  let payment = await findPayment(context.supabaseAdmin, paymentId);
  if (!payment) {
    throw new AppError(404, "payment_not_found", "Payment not found.");
  }

  const status = publicPaymentStatus(payment);
  if (status === "pending" || status === "processing") {
    try {
      const intent = await getPayment(payment.kuti_payment_intent_id);
      payment = await syncPayment(context.supabaseAdmin, payment, intent);
    } catch (error) {
      // La pantalla vuelve a consultar en unos segundos.
      console.error("Could not sync Kuti payment", paymentId, error);
    }
  }
  return json(statusResponse(payment));
}
