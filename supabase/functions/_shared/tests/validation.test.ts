import assert from "node:assert/strict";
import { AppError } from "../errors.ts";
import {
  assertCredential,
  assertPassword,
  generateCredential,
  generatePassword,
  generatePin,
} from "../password.ts";
import {
  assertDateOrder,
  isWithinDateRange,
  limaDate,
  option,
  uuid,
} from "../validation.ts";

Deno.test("validates UUIDs and answer options", () => {
  assert.equal(
    uuid("a51ec034-3e1b-4fa2-9e7a-8bc641de87d1", "id"),
    "a51ec034-3e1b-4fa2-9e7a-8bc641de87d1",
  );
  assert.equal(option("b"), "B");
  assert.throws(() => option("E"), AppError);
});

Deno.test("uses Lima calendar dates for access checks", () => {
  const instant = new Date("2026-07-27T03:30:00.000Z");
  assert.equal(limaDate(instant), "2026-07-26");
  assert.equal(
    isWithinDateRange("2026-07-26", "2026-07-01", "2026-07-26"),
    true,
  );
  assert.equal(
    isWithinDateRange("2026-07-27", "2026-07-01", "2026-07-26"),
    false,
  );
  assert.throws(() => assertDateOrder("2026-08-01", "2026-07-01"), AppError);
});

Deno.test("generates passwords satisfying the application policy", () => {
  const password = generatePassword();
  assert.equal(password.length, 12);
  assert.doesNotThrow(() => assertPassword(password));
  assert.throws(() => assertPassword("password"));
});

Deno.test("supports six-digit student PINs without weakening teacher passwords", () => {
  const pin = generatePin();
  assert.match(pin, /^\d{6}$/);
  assert.match(generateCredential("student"), /^\d{6}$/);
  assert.doesNotThrow(() => assertCredential("student", "482731"));
  assert.throws(() => assertCredential("student", "12345"));
  assert.throws(() => assertCredential("teacher", "482731"));
  assert.doesNotThrow(() => assertCredential("teacher", generatePassword()));
  assert.doesNotThrow(() => assertCredential("admin", generateCredential("admin")));
});
