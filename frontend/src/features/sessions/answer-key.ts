import type { AnswerKeyEntry, EncryptedAnswerKey } from "../../types/contracts";

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

/**
 * Descifra la clave de respuestas de la sesión (AES-GCM) para corregir cada
 * pregunta al instante. La nota real la recalcula el servidor al enviar.
 */
export async function decryptAnswerKey(answerKey: EncryptedAnswerKey): Promise<Record<string, AnswerKeyEntry>> {
  const key = await crypto.subtle.importKey("raw", fromBase64(answerKey.key), "AES-GCM", false, ["decrypt"]);
  const decoder = new TextDecoder();
  const entries = await Promise.all(Object.entries(answerKey.items).map(async ([id, item]) => {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(item.iv) }, key, fromBase64(item.data));
    return [id, JSON.parse(decoder.decode(plain)) as AnswerKeyEntry] as const;
  }));
  return Object.fromEntries(entries);
}
