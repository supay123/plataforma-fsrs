import assert from "node:assert/strict";
import { peruvianPhone, verifyWebhookSignature } from "../kuti.ts";
import { publicPaymentStatus, splitFullName } from "../plan-payments.ts";

const SECRET = "whsec_test_123";
const BODY = '{"id":"evt_1","type":"payment.succeeded"}';

async function sign(timestamp: number, body = BODY, secret = SECRET) {
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
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return `v1=${
    Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  }`;
}

function headers(timestamp: number, signature: string) {
  return new Headers({
    "x-kuti-id": "evt_1",
    "x-kuti-timestamp": String(timestamp),
    "x-kuti-signature": signature,
  });
}

Deno.test("accepts a recent webhook signed with the secret", async () => {
  const now = Date.now();
  const timestamp = Math.floor(now / 1000);
  assert.equal(
    await verifyWebhookSignature(
      BODY,
      headers(timestamp, await sign(timestamp)),
      SECRET,
      now,
    ),
    true,
  );
});

Deno.test("rejects altered, foreign, old or unsigned webhooks", async () => {
  const now = Date.now();
  const timestamp = Math.floor(now / 1000);
  const valid = await sign(timestamp);
  assert.equal(
    await verifyWebhookSignature(
      BODY.replace("succeeded", "failed"),
      headers(timestamp, valid),
      SECRET,
      now,
    ),
    false,
  );
  assert.equal(
    await verifyWebhookSignature(
      BODY,
      headers(timestamp, await sign(timestamp, BODY, "whsec_other")),
      SECRET,
      now,
    ),
    false,
  );
  const old = timestamp - 301;
  assert.equal(
    await verifyWebhookSignature(
      BODY,
      headers(old, await sign(old)),
      SECRET,
      now,
    ),
    false,
  );
  assert.equal(
    await verifyWebhookSignature(BODY, new Headers(), SECRET, now),
    false,
  );
});

Deno.test("formats Peruvian mobile numbers for Kuti", () => {
  assert.equal(peruvianPhone("987 654 321"), "+51987654321");
  assert.equal(peruvianPhone("+51 987-654-321"), "+51987654321");
  assert.equal(peruvianPhone("01 4567890"), undefined);
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
    publicPaymentStatus({ ...registration, status: "succeeded" }),
    "processing",
  );
  assert.equal(
    publicPaymentStatus({
      registration_id: null,
      profile_id: "p",
      applied_at: null,
      status: "succeeded",
    }),
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

Deno.test("splits a full name for Kuti", () => {
  assert.deepEqual(splitFullName("Ana María Quispe"), {
    first_name: "Ana",
    last_name: "María Quispe",
  });
  assert.deepEqual(splitFullName("Ana"), { first_name: "Ana", last_name: "-" });
});
