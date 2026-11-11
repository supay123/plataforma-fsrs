import type {
  AnswerKeyEntry,
  EncryptedAnswerKey,
} from "./interfaces/session.interfaces.ts";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Cifra la clave de respuestas de una sesión (opción correcta y explicación de
 * cada pregunta) con AES-GCM y una llave aleatoria por sesión, para que el
 * navegador corrija al instante sin otra llamada al servidor.
 *
 * La llave viaja en la misma respuesta: esto evita que las respuestas se lean
 * a simple vista, pero no es un secreto frente a un estudiante decidido. Por
 * eso la nota y FSRS se recalculan siempre en el servidor al enviar la sesión.
 */
export async function encryptAnswerKey(
  entries: Record<string, AnswerKeyEntry>,
): Promise<EncryptedAnswerKey> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"],
  );
  const encoder = new TextEncoder();
  const items = Object.fromEntries(
    await Promise.all(
      Object.entries(entries).map(async ([id, entry]) => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const data = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          encoder.encode(JSON.stringify(entry)),
        );
        return [id, {
          iv: toBase64(iv),
          data: toBase64(new Uint8Array(data)),
        }] as const;
      }),
    ),
  );
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return { algorithm: "AES-GCM", key: toBase64(raw), items };
}
