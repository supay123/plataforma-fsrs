import assert from "node:assert/strict";
import {
  hashSecurityAnswer,
  verifySecurityAnswer,
} from "../security-answer.ts";

Deno.test("security answers are salted and matched without case or whitespace sensitivity", async () => {
  const first = await hashSecurityAnswer("  Lima   Norte ");
  const second = await hashSecurityAnswer("Lima Norte");
  assert.notEqual(first, second);
  assert.equal(await verifySecurityAnswer("lima norte", first), true);
  assert.equal(await verifySecurityAnswer("otra respuesta", first), false);
});
