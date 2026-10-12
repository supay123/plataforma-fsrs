import { RPCS } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import {
  type KutiEvent,
  kutiMode,
  verifyWebhookSignature,
} from "../_shared/kuti.ts";
import { findPaymentByKutiId, syncPayment } from "../_shared/plan-payments.ts";
import type { EdgeContext } from "../_shared/types.ts";

/**
 * POST /kuti/webhook
 * Verifica la firma y aplica el resultado del cobro. Si algo falla responde
 * error para que Kuti reintente; aplicar un pago dos veces no tiene efecto.
 */
export async function receiveWebhook(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const rawBody = await request.text();
  const { data: secret, error } = await context.supabaseAdmin.rpc(
    RPCS.kutiWebhookSecret,
    { p_mode: kutiMode() },
  );
  if (error) throw new AppError(500, "webhook_lookup_failed", error.message);
  if (
    !secret ||
    !(await verifyWebhookSignature(rawBody, request.headers, secret))
  ) {
    throw new AppError(401, "invalid_signature", "Invalid Kuti signature.");
  }

  const event = JSON.parse(rawBody) as KutiEvent;
  const intent = event.data?.payment_intent;
  if (!event.type?.startsWith("payment.") || !intent?.id) {
    return json({ received: true });
  }

  const payment = await findPaymentByKutiId(context.supabaseAdmin, intent.id);
  // Cobros que no nacieron en la plataforma (por ejemplo, links del panel).
  if (!payment) return json({ received: true });

  await syncPayment(context.supabaseAdmin, payment, intent);
  return json({ received: true });
}
