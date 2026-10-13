import { AppError } from "./errors.ts";

export interface MimeMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

let cachedToken: { value: string; expiresAt: number } | null = null;

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function utf8Base64(value: string): string {
  return base64(new TextEncoder().encode(value));
}

/** Encabezado con caracteres no ASCII (tildes, ñ) según RFC 2047. */
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${utf8Base64(value)}?=`;
}

/** "Nombre <correo>" con el nombre codificado si lleva tildes. */
function encodeAddress(value: string): string {
  const match = value.match(/^\s*(.+?)\s*<([^>]+)>\s*$/);
  return match ? `${encodeHeader(match[1]!)} <${match[2]}>` : value.trim();
}

function wrappedBase64(value: string): string {
  return utf8Base64(value).replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

/** Arma el correo en formato RFC 2822 con versión de texto y HTML. */
export function buildMimeMessage(
  message: MimeMessage,
  boundary: string,
): string {
  return [
    `From: ${encodeAddress(message.from)}`,
    `To: ${message.to}`,
    `Subject: ${encodeHeader(message.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrappedBase64(message.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrappedBase64(message.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** La API de Gmail espera el correo completo en base64url. */
export function toBase64Url(raw: string): string {
  return utf8Base64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=+$/,
    "",
  );
}

function unavailable(): AppError {
  return new AppError(503, "email_unavailable", "Email could not be sent.");
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new AppError(
      503,
      "email_unavailable",
      "Email delivery is not configured.",
    );
  }
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
  } catch (error) {
    console.error("Gmail token request failed", error);
    throw unavailable();
  }
  const body = await response.json().catch(() => null) as
    | { access_token?: string; expires_in?: number; error?: string }
    | null;
  if (!response.ok || !body?.access_token) {
    // invalid_grant: el token se revocó (cambio de contraseña del Gmail, app
    // en modo prueba o permiso retirado). Hay que generar uno nuevo.
    console.error(
      "Gmail token was rejected",
      response.status,
      body?.error ?? "",
    );
    throw unavailable();
  }
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(0, (body.expires_in ?? 3600) - 60) * 1000,
  };
  return cachedToken.value;
}

export async function sendWithGmail(message: MimeMessage): Promise<void> {
  const token = await accessToken();
  const raw = toBase64Url(buildMimeMessage(message, crypto.randomUUID()));
  let response: Response;
  try {
    response = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
  } catch (error) {
    console.error("Gmail send request failed", error);
    throw unavailable();
  }
  if (!response.ok) {
    if (response.status === 401) cachedToken = null;
    console.error(
      "Gmail send was rejected",
      response.status,
      await response.text().catch(() => ""),
    );
    throw unavailable();
  }
}
