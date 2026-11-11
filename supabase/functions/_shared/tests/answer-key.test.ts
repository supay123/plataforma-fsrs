import assert from "node:assert/strict";
import { encryptAnswerKey } from "../answer-key.ts";

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

Deno.test("encrypts each answer so the shipped key can decrypt it", async () => {
  const encrypted = await encryptAnswerKey({
    "question-1": { correct_option: "B", explanation: "Porque sí." },
    "question-2": { correct_option: "D", explanation: null },
  });
  assert.equal(encrypted.algorithm, "AES-GCM");
  assert.deepEqual(Object.keys(encrypted.items).sort(), [
    "question-1",
    "question-2",
  ]);
  assert.ok(!JSON.stringify(encrypted.items).includes("Porque"));

  const key = await crypto.subtle.importKey(
    "raw",
    fromBase64(encrypted.key),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const item = encrypted.items["question-1"]!;
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(item.iv) },
    key,
    fromBase64(item.data),
  );
  assert.deepEqual(JSON.parse(new TextDecoder().decode(plain)), {
    correct_option: "B",
    explanation: "Porque sí.",
  });
});

Deno.test("uses a different key and IV on every call", async () => {
  const entry = { "q": { correct_option: "A", explanation: null } };
  const [first, second] = await Promise.all([
    encryptAnswerKey(entry),
    encryptAnswerKey(entry),
  ]);
  assert.notEqual(first.key, second.key);
  assert.notEqual(first.items.q!.iv, second.items.q!.iv);
});
