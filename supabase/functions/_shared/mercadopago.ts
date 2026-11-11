// Cliente mínimo de la API de órdenes de Mercado Pago (Checkout API via Orders,
// https://www.mercadopago.com.pe/developers/en/docs/checkout-api-orders) para
// cobrar con Yape. El Access Token vive solo en el servidor
// (MERCADOPAGO_ACCESS_TOKEN); la Public Key (MERCADOPAGO_PUBLIC_KEY) se entrega
// al navegador para que convierta el celular y el OTP de Yape en un token.
// Ambos son de prueba o de producción según el entorno del que se copiaron en
// Tus integraciones; los dos empiezan con APP_USR-.

import { AppError } from "./errors.ts";

const MERCADOPAGO_API = "https://api.mercadopago.com";
/** Antigüedad máxima de un aviso firmado. */
const WEBHOOK_TOLERANCE_MS = 5 * 60_000;

/**
 * Estado de la orden. Yape en modo automático responde en el acto con
 * processed (aprobado) o failed (rechazado).
 */
export type MercadoPagoOrderStatus =
  | "created"
  | "processing"
  | "action_required"
  | "processed"
  | "failed"
  | "canceled"
  | "refunded"
  | "charged_back";

export interface MercadoPagoOrder {
  id: string;
  status: MercadoPagoOrderStatus;
  status_detail: string | null;
  external_reference: string | null;
  total_amount: string;
  last_updated_date: string | null;
  transactions?: {
    payments?: Array<{ id: string; status: string; status_detail: string }>;
  };
  /** Solo llega en el aviso del webhook. */
  live_mode?: boolean;
}

/**
 * Motivo del resultado. El de la orden solo dice "failed" o "accredited"; el
 * del pago da la causa (por ejemplo, insufficient_amount).
 */
export function orderStatusDetail(order: MercadoPagoOrder): string | null {
  return order.transactions?.payments?.[0]?.status_detail ??
    order.status_detail;
}

export interface MercadoPagoNotification {
  type?: string;
  action?: string;
  live_mode?: boolean;
  data?: { id?: string | number };
}

function credential(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new AppError(
      503,
      "payments_unavailable",
      "Online payments are not configured.",
    );
  }
  return value;
}

export function publicKey(): string {
  return credential("MERCADOPAGO_PUBLIC_KEY");
}

type ErrorPayload = {
  message?: string;
  errors?: Array<{ code?: string; message?: string; details?: unknown }>;
  /** Al rechazar un pago (402) llega aquí la orden fallida. */
  data?: MercadoPagoOrder;
};

async function mercadoPagoRequest<T>(
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${credential("MERCADOPAGO_ACCESS_TOKEN")}`,
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) {
    headers["X-Idempotency-Key"] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(`${MERCADOPAGO_API}${path}`, {
      method,
      headers,
      body: options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
    });
  } catch (error) {
    console.error("Mercado Pago request failed", method, path, error);
    throw new AppError(
      502,
      "payment_provider_unavailable",
      "The payment provider is not reachable.",
    );
  }

  const payload = await response.json().catch(() => null) as
    | (T & ErrorPayload)
    | null;
  // 402: Yape rechazó el pago. No es un error de la integración: la orden
  // fallida llega en data, con el motivo en sus transacciones.
  if (response.status === 402 && payload?.data?.id) {
    return payload.data as T;
  }
  if (!response.ok || !payload) {
    console.error("Mercado Pago error", method, path, response.status, payload);
    const first = payload?.errors?.[0];
    throw new AppError(
      response.status === 402 ? 402 : 502,
      response.status === 402 ? "payment_rejected" : "payment_provider_error",
      first?.message ?? payload?.message ??
        "The payment provider rejected the request.",
      { provider_code: first?.code, provider_status: response.status },
    );
  }
  return payload;
}

/**
 * Crea y procesa en el acto una orden pagada con Yape, usando el token que
 * generó el navegador (de un solo uso). La respuesta ya trae el resultado.
 */
export function createYapeOrder(input: {
  reference: string;
  amount: string;
  token: string;
  email: string;
  phone: string;
}): Promise<MercadoPagoOrder> {
  return mercadoPagoRequest<MercadoPagoOrder>("POST", "/v1/orders", {
    // La misma referencia nunca cobra dos veces, aunque se reintente.
    idempotencyKey: input.reference,
    body: {
      type: "online",
      processing_mode: "automatic",
      external_reference: input.reference,
      total_amount: input.amount,
      payer: {
        email: input.email,
        phone: { area_code: "51", number: input.phone },
      },
      transactions: {
        payments: [{
          amount: input.amount,
          payment_method: {
            id: "yape",
            type: "debit_card",
            token: input.token,
          },
        }],
      },
    },
  });
}

export function getOrder(id: string): Promise<MercadoPagoOrder> {
  return mercadoPagoRequest<MercadoPagoOrder>(
    "GET",
    `/v1/orders/${encodeURIComponent(id)}`,
  );
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

/**
 * Verifica x-signature ("ts=…,v1=…"): v1 es HMAC-SHA256(secreto,
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"), con data.id en
 * minúsculas y un ts de hace menos de 5 minutos. Si falta
 * data.id o x-request-id, su parte no entra en el texto firmado.
 */
export async function verifyWebhookSignature(
  dataId: string | null,
  headers: Headers,
  signingSecret: string,
  now = Date.now(),
): Promise<boolean> {
  const parts = Object.fromEntries(
    (headers.get("x-signature") ?? "").split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  const ts = parts.ts;
  const signature = parts.v1;
  if (!ts || !signature) return false;
  // La documentación habla de milisegundos; se aceptan también segundos.
  const sentAt = Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts);
  if (!(Math.abs(now - sentAt) <= WEBHOOK_TOLERANCE_MS)) return false;

  const requestId = headers.get("x-request-id");
  let manifest = "";
  if (dataId) manifest += `id:${dataId.toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)),
  );
  return constantTimeEqual(signature, expected);
}
