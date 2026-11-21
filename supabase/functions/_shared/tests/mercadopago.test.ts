import assert from "node:assert/strict";
import {
  createYapeOrder,
  type MercadoPagoOrder,
  orderStatusDetail,
  verifyWebhookSignature,
} from "../mercadopago.ts";
import {
  deviceSessionId,
  publicPaymentStatus,
  yapePhone,
  yapeToken,
} from "../plan-payments.ts";

const SECRET = "mp_webhook_secret_123";
const DATA_ID = "123456789";
const REQUEST_ID = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e";

async function sign(
  ts: number,
  dataId = DATA_ID,
  requestId = REQUEST_ID,
  secret = SECRET,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(
      `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`,
    ),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function headers(ts: number, v1: string) {
  return new Headers({
    "x-signature": `ts=${ts},v1=${v1}`,
    "x-request-id": REQUEST_ID,
  });
}

Deno.test("accepts a recent notification signed with the secret", async () => {
  const now = Date.now();
  assert.equal(
    await verifyWebhookSignature(
      DATA_ID,
      headers(now, await sign(now)),
      SECRET,
      now,
    ),
    true,
  );
  // ts en segundos también vale.
  const seconds = Math.floor(now / 1000);
  assert.equal(
    await verifyWebhookSignature(
      DATA_ID,
      headers(seconds, await sign(seconds)),
      SECRET,
      now,
    ),
    true,
  );
});

Deno.test("signs data.id in lowercase", async () => {
  const now = Date.now();
  assert.equal(
    await verifyWebhookSignature(
      "ABC123",
      headers(now, await sign(now, "abc123")),
      SECRET,
      now,
    ),
    true,
  );
});

Deno.test("rejects altered, foreign, old or unsigned notifications", async () => {
  const now = Date.now();
  const valid = await sign(now);
  assert.equal(
    await verifyWebhookSignature("999", headers(now, valid), SECRET, now),
    false,
  );
  assert.equal(
    await verifyWebhookSignature(
      DATA_ID,
      headers(now, await sign(now, DATA_ID, REQUEST_ID, "other")),
      SECRET,
      now,
    ),
    false,
  );
  const old = now - 301_000;
  assert.equal(
    await verifyWebhookSignature(
      DATA_ID,
      headers(old, await sign(old)),
      SECRET,
      now,
    ),
    false,
  );
  assert.equal(
    await verifyWebhookSignature(DATA_ID, new Headers(), SECRET, now),
    false,
  );
});

Deno.test("only accepts a Yape token-like value", () => {
  assert.equal(
    yapeToken("ff8080814c11e237014c1ff593b57b4d"),
    "ff8080814c11e237014c1ff593b57b4d",
  );
  assert.throws(() => yapeToken(undefined));
  assert.throws(() => yapeToken("abc"));
  assert.throws(() => yapeToken("token with spaces"));
});

Deno.test("normalizes the 9-digit Yape phone, test numbers included", () => {
  assert.equal(yapePhone("111111111"), "111111111");
  assert.equal(yapePhone("+51 987 654 321"), "987654321");
  assert.throws(() => yapePhone("98765"));
  assert.throws(() => yapePhone(undefined));
});

Deno.test("takes the rejection reason from the payment, not the order", () => {
  const order: MercadoPagoOrder = {
    id: "ORDTST01",
    status: "failed",
    status_detail: "failed",
    external_reference: "ref",
    total_amount: "14.90",
    last_updated_date: null,
    transactions: {
      payments: [{
        id: "PAY01",
        status: "failed",
        status_detail: "insufficient_amount",
      }],
    },
  };
  assert.equal(orderStatusDetail(order), "insufficient_amount");
  assert.equal(
    orderStatusDetail({ ...order, transactions: undefined }),
    "failed",
  );
});

Deno.test("only an applied payment counts as paid", () => {
  const registration = {
    registration_id: "r",
    profile_id: null,
    applied_at: null,
  };
  assert.equal(
    publicPaymentStatus({ ...registration, status: "pending" }),
    "pending",
  );
  assert.equal(
    publicPaymentStatus({ ...registration, status: "failed" }),
    "failed",
  );
  assert.equal(
    publicPaymentStatus({ ...registration, status: "succeeded" }),
    "processing",
  );
  assert.equal(
    publicPaymentStatus({
      registration_id: null,
      profile_id: "p",
      applied_at: "2026-10-12T00:00:00Z",
      status: "succeeded",
    }),
    "paid",
  );
  assert.equal(
    publicPaymentStatus({
      registration_id: null,
      profile_id: null,
      applied_at: null,
      status: "succeeded",
    }),
    "needs_support",
  );
});

Deno.test("accepts a device id of Mercado Pago and ignores anything else", () => {
  const real = "armor." + "a1b2c3d4".repeat(28);
  assert.equal(deviceSessionId(real), real);
  assert.equal(deviceSessionId(undefined), undefined);
  assert.equal(deviceSessionId("short"), undefined);
  assert.equal(deviceSessionId("has spaces and \n"), undefined);
  assert.equal(deviceSessionId("x".repeat(513)), undefined);
});

Deno.test("describes the plan and the device in the Yape order, never the payer's identity", async () => {
  const originalFetch = globalThis.fetch;
  Deno.env.set("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-test");
  let sent: { headers: Headers; body: Record<string, unknown> } | undefined;
  globalThis.fetch = (_url, init) => {
    sent = {
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    };
    return Promise.resolve(
      Response.json({ id: "ORD1", status: "processed" }, { status: 201 }),
    );
  };
  try {
    await createYapeOrder({
      reference: "ref-1",
      amount: "14.90",
      token: "token-12345678",
      email: "student@example.com",
      phone: "987654321",
      plan: { code: "mensual", name: "Plan Estudiante" },
      deviceSessionId: "device-12345678",
    });
    assert.equal(sent?.headers.get("x-meli-session-id"), "device-12345678");
    assert.equal(sent?.body.description, "Plan Estudiante");
    assert.deepEqual(sent?.body.items, [{
      title: "Plan Estudiante",
      description: "Plan Estudiante",
      external_code: "mensual",
      category_id: "learnings",
      unit_price: "14.90",
      quantity: 1,
    }]);
    const payer = sent?.body.payer as Record<string, unknown>;
    assert.deepEqual(Object.keys(payer).sort(), ["email", "phone"]);

    await createYapeOrder({
      reference: "ref-2",
      amount: "14.90",
      token: "token-12345678",
      email: "student@example.com",
      phone: "987654321",
      plan: { code: "mensual", name: "Plan Estudiante" },
    });
    assert.equal(sent?.headers.has("x-meli-session-id"), false);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("MERCADOPAGO_ACCESS_TOKEN");
  }
});
