// Códigos de 6 dígitos para verificar un correo (registro y cambio de correo).
// Solo se guarda su hash, ligado a su dueño (el registro o el usuario) para
// que no sirva en otro. Al usarse, el código se borra.

export const EMAIL_CODE_TTL_MINUTES = 10;
export const EMAIL_CODE_RESEND_SECONDS = 60;
export const EMAIL_CODE_MAX_SENDS = 5;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

export function generateEmailCode(): string {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => String(value % 10)).join("");
}

export async function hashEmailCode(
  registrationId: string,
  code: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${registrationId}:${code}`),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function verifyEmailCode(
  registrationId: string,
  code: string,
  expectedHash: string,
): Promise<boolean> {
  const actual = await hashEmailCode(registrationId, code);
  if (actual.length !== expectedHash.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) {
    difference |= actual.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return difference === 0;
}
