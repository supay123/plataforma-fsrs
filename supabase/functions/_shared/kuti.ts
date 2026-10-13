// Cliente mínimo de la API de Kuti (https://docs.kuti.pe). La llave secreta
// vive solo en el servidor (KUTI_SECRET_KEY) y su prefijo elige el modo:
// kuti_test_… no mueve dinero; kuti_live_… sí.

import { AppError } from "./errors.ts";

const KUTI_API = "https://api.kuti.pe/v1";
/** Antigüedad máxima de un aviso firmado, según Kuti. */
const WEBHOOK_TOLERANCE_SECONDS = 300;
/** Monto mínimo que Kuti acepta para pagar con código de pago de servicios. */
export const BANK_CODE_MIN_AMOUNT = 50;

export type KutiMode = "test" | "live";

export type KutiPaymentStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

export interface KutiPaymentIntent {
  id: string;
  livemode: boolean;
  status: KutiPaymentStatus;
  amount: { amount: string; currency: string };
  payment_method?: {
    qr?: { payload: string; expires_at: string };
    payment_code?: { code: string; expires_at: string };
  } | null;
  paid_with?: { method_type: string; paid_at: string } | null;
  checkout_url?: string | null;
  external_reference?: string | null;
}

export interface KutiEvent {
  id: string;
  type: string;
  data: { payment_intent?: KutiPaymentIntent };
}

export interface KutiCustomer {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
}

function secretKey(): string {
  const key = Deno.env.get("KUTI_SECRET_KEY");
  if (!key) {
    throw new AppError(
      503,
      "payments_unavailable",
      "Online payments are not configured.",
    );
  }
  return key;
}

export function kutiMode(): KutiMode {
  return secretKey().startsWith("kuti_live_") ? "live" : "test";
}

async function kutiRequest<T>(
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey()}`,
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(`${KUTI_API}${path}`, {
      method,
      headers,
      body: options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
    });
  } catch (error) {
    console.error("Kuti request failed", method, path, error);
    throw new AppError(
      502,
      "payment_provider_unavailable",
      "The payment provider is not reachable.",
    );
  }

  const payload = await response.json().catch(() => null) as
    | {
      success?: boolean;
      message?: string;
      data?: T;
      error?: { code?: string };
    }
    | null;
  if (!response.ok || !payload?.success || payload.data === undefined) {
    console.error("Kuti error", method, path, response.status, payload);
    throw new AppError(
      502,
      "payment_provider_error",
      payload?.message ?? "The payment provider rejected the request.",
      { provider_code: payload?.error?.code },
    );
  }
  return payload.data;
}

/** Celular peruano en E.164 (+51…), o undefined si no lo parece. */
export function peruvianPhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "").replace(/^51(?=9\d{8}$)/, "");
  return /^9\d{8}$/.test(digits) ? `+51${digits}` : undefined;
}

/**
 * Crea un cobro único pagable con QR (Yape, Plin y billeteras) y, desde
 * BANK_CODE_MIN_AMOUNT, también con código de pago de servicios. Kuti no envía
 * nada al cliente: el QR y el código se muestran en la plataforma.
 */
export function createCharge(input: {
  reference: string;
  amount: string;
  description: string;
  expiresAt: Date;
  customer: KutiCustomer;
}): Promise<KutiPaymentIntent> {
  const methods = Number(input.amount) >= BANK_CODE_MIN_AMOUNT
    ? ["INTEROPERABLE_QR", "BANK_TRANSFER"]
    : ["INTEROPERABLE_QR"];
  return kutiRequest<KutiPaymentIntent>("POST", "/payment-intents", {
    // La misma referencia nunca crea dos cobros, aunque se reintente.
    idempotencyKey: input.reference,
    body: {
      amount: { amount: input.amount, currency: "PEN" },
      payment_method_types: methods,
      customer: { type: "INDIVIDUAL", ...input.customer },
      send_via: [],
      description: input.description,
      external_reference: input.reference,
      expires_at: input.expiresAt.toISOString(),
    },
  });
}

export function getPayment(id: string): Promise<KutiPaymentIntent> {
  return kutiRequest<KutiPaymentIntent>(
    "GET",
    `/payment-intents/${encodeURIComponent(id)}`,
  );
}

/**
 * Solo modo prueba: da por pagado un cobro sin dinero real, como si el cliente
 * hubiera pagado con ese método. Kuti lo rechaza con una llave de producción.
 */
export function simulatePayment(
  id: string,
  method: "INTEROPERABLE_QR" | "BANK_TRANSFER",
): Promise<KutiPaymentIntent> {
  return kutiRequest<KutiPaymentIntent>(
    "POST",
    `/payment-intents/${encodeURIComponent(id)}/simulate`,
    { body: { outcome: "SUCCEEDED", payment_method_type: method } },
  );
}

export function cancelPayment(id: string): Promise<KutiPaymentIntent> {
  return kutiRequest<KutiPaymentIntent>(
    "POST",
    `/payment-intents/${encodeURIComponent(id)}/cancel`,
    { idempotencyKey: crypto.randomUUID() },
  );
}

/** UUID estable derivado de un texto: misma entrada, misma llave. */
async function stableUuid(text: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  ).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const value = hex(bytes.buffer);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${
    value.slice(16, 20)
  }-${value.slice(20)}`;
}

/**
 * Registra la URL que recibe los avisos de Kuti. La misma URL en el mismo modo
 * devuelve el mismo endpoint y el mismo secreto, aunque se llame dos veces.
 */
export async function registerWebhook(url: string): Promise<string> {
  const endpoint = await kutiRequest<{ signing_secret?: string }>(
    "POST",
    "/webhook-endpoints",
    {
      idempotencyKey: await stableUuid(`webhook:${kutiMode()}:${url}`),
      body: {
        url,
        events: [
          "payment.succeeded",
          "payment.failed",
          "payment.expired",
          "payment.cancelled",
        ],
        description: "Plataforma Chancón",
      },
    },
  );
  if (!endpoint.signing_secret) {
    throw new AppError(
      502,
      "payment_provider_error",
      "Kuti did not return the webhook signing secret.",
    );
  }
  return endpoint.signing_secret;
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
 * Verifica X-Kuti-Signature: "v1=" + HMAC-SHA256(secreto, "<timestamp>.<body>"),
 * con un timestamp de hace menos de 5 minutos.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  headers: Headers,
  signingSecret: string,
  now = Date.now(),
): Promise<boolean> {
  const timestamp = headers.get("x-kuti-timestamp");
  const signature = headers.get("x-kuti-signature");
  if (!headers.get("x-kuti-id") || !timestamp || !signature) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = `v1=${
    hex(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${timestamp}.${rawBody}`),
      ),
    )
  }`;
  return constantTimeEqual(signature, expected);
}
