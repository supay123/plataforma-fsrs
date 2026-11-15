// Códigos de un solo uso que viajan en la URL de un link enviado por correo
// (restablecer contraseña, invitaciones). Son largos y aleatorios (32 bytes);
// en la base solo se guarda su SHA-256.

const LINK_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateLinkCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Descarta de entrada lo que no puede ser un código emitido por nosotros. */
export function isLinkCodeFormat(value: unknown): value is string {
  return typeof value === "string" && LINK_CODE_PATTERN.test(value);
}

export async function hashLinkCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function linkWithCode(
  origin: string,
  path: string,
  code: string,
  instId?: string | null,
): string {
  const inst = instId ? `&instId=${encodeURIComponent(instId)}` : "";
  return `${origin}${path}?code=${encodeURIComponent(code)}${inst}`;
}
