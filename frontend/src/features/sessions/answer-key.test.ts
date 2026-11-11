import { describe, expect, it } from "vitest";
import type { AnswerKeyEntry, EncryptedAnswerKey } from "../../types/contracts";
import { decryptAnswerKey } from "./answer-key";

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

// Mismo esquema que supabase/functions/_shared/answer-key.ts.
async function encrypt(entries: Record<string, AnswerKeyEntry>): Promise<EncryptedAnswerKey> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const items: EncryptedAnswerKey["items"] = {};
  for (const [id, entry] of Object.entries(entries)) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(entry)));
    items[id] = { iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
  }
  return { algorithm: "AES-GCM", key: toBase64(new Uint8Array(await crypto.subtle.exportKey("raw", key))), items };
}

describe("decryptAnswerKey", () => {
  it("recovers the correct option and explanation of every question", async () => {
    const entries = {
      "sq-1": { correct_option: "C", explanation: "Por la regla de tres." },
      "sq-2": { correct_option: "A", explanation: null },
    } satisfies Record<string, AnswerKeyEntry>;
    await expect(decryptAnswerKey(await encrypt(entries))).resolves.toEqual(entries);
  });

  it("rejects tampered data", async () => {
    const encrypted = await encrypt({ "sq-1": { correct_option: "B", explanation: null } });
    const other = await encrypt({ "sq-1": { correct_option: "B", explanation: null } });
    await expect(decryptAnswerKey({ ...encrypted, key: other.key })).rejects.toThrow();
  });
});
