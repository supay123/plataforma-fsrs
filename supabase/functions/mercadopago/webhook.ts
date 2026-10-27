import { RPCS } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import {
  getOrder,
  type MercadoPagoNotification,
  verifyWebhookSignature,
} from "../_shared/mercadopago.ts";
import { findPayment, syncPayment } from "../_shared/plan-payments.ts";
import type { EdgeContext } from "../_shared/types.ts";

/**
 * POST /mercadopago/webhook
 * Verifica la firma, consulta la orden en Mercado Pago (GET /v1/orders/{id})
 * y aplica el resultado. Si algo falla responde error para que Mercado
 * Pago reintente; aplicar un pago dos veces no tiene efecto.
 */
export async function receiveWebhook(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const notification = await request.json().catch(
    () => ({}),
  ) as MercadoPagoNotification;
  const dataId = new URL(request.url).searchParams.get("data.id") ??
    (notification.data?.id === undefined ? null : String(notification.data.id));

  const { data: secret, error } = await context.supabaseAdmin.rpc(
    RPCS.mercadoPagoWebhookSecret,
  );
  if (error) throw new AppError(500, "webhook_lookup_failed", error.message);
  if (
    !secret ||
    !(await verifyWebhookSignature(dataId, request.headers, secret))
  ) {
    throw new AppError(
      401,
      "invalid_signature",
      "Invalid Mercado Pago signature.",
    );
  }

  if (notification.type !== "order" || !dataId) {
    return json({ received: true });
  }

  const order = await getOrder(dataId);
  const payment = order.external_reference
    ? await findPayment(context.supabaseAdmin, order.external_reference)
      .catch(() => null)
    : null;
  // Órdenes que no nacieron en la plataforma (por ejemplo, links del panel).
  if (!payment) return json({ received: true });

  await syncPayment(context.supabaseAdmin, payment, {
    ...order,
    live_mode: notification.live_mode,
  });
  return json({ received: true });
}
