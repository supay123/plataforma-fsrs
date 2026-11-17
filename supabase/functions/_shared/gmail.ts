import type { EmailAttachment } from "./email.ts";
import { AppError } from "./errors.ts";

export interface MimeMessage {
  from: string;
  to: string;
  cc?: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
// Los correos con adjuntos se suben tal cual (hasta 35 MB) en vez de ir en JSON.
const UPLOAD_URL =
  "https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media";

let cachedToken: { value: string; expiresAt: number } | null = null;

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  // Por bloques: String.fromCharCode con millones de argumentos desborda la pila.
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function utf8Base64(value: string): string {
  return encodeBase64(new TextEncoder().encode(value));
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

function wrapLines(base64: string): string {
  return base64.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

function wrappedBase64(value: string): string {
  return wrapLines(utf8Base64(value));
}

/** Nombre de archivo sin comillas ni saltos de línea, codificado si lleva tildes. */
function attachmentName(filename: string): string {
  return encodeHeader(filename.replace(/["\\\r\n]/g, "_"));
}

/**
 * Arma el correo en formato RFC 2822 con versión de texto y HTML. Con adjuntos,
 * ambas versiones van dentro de un multipart/mixed junto a los archivos.
 */
export function buildMimeMessage(
  message: MimeMessage,
  boundary: string,
): string {
  const headers = [
    `From: ${encodeAddress(message.from)}`,
    `To: ${message.to}`,
    ...(message.cc ? [`Cc: ${message.cc}`] : []),
    ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []),
    `Subject: ${encodeHeader(message.subject)}`,
    "MIME-Version: 1.0",
  ];
  const alternative = (altBoundary: string) => [
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrappedBase64(message.text),
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrappedBase64(message.html),
    `--${altBoundary}--`,
  ];
  if (!message.attachments?.length) {
    return [...headers, ...alternative(boundary), ""].join("\r\n");
  }
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    ...alternative(`${boundary}-alt`),
    ...message.attachments.flatMap((file) => [
      `--${boundary}`,
      `Content-Type: ${file.contentType}; name="${
        attachmentName(file.filename)
      }"`,
      `Content-Disposition: attachment; filename="${
        attachmentName(file.filename)
      }"`,
      "Content-Transfer-Encoding: base64",
      "",
      wrapLines(encodeBase64(file.content)),
    ]),
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
  const mime = buildMimeMessage(message, crypto.randomUUID());
  const upload = Boolean(message.attachments?.length);
  let response: Response;
  try {
    response = await fetch(upload ? UPLOAD_URL : SEND_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": upload ? "message/rfc822" : "application/json",
      },
      body: upload ? mime : JSON.stringify({ raw: toBase64Url(mime) }),
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
