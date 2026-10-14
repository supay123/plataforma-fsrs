import { AppError } from "./errors.ts";
import { encodeBase64, sendWithGmail } from "./gmail.ts";

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Uint8Array;
}

export interface EmailMessage {
  to: string;
  cc?: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
}

/**
 * Envía correos con el proveedor de EMAIL_DELIVERY:
 * - "gmail": API de Gmail (mientras no haya dominio propio).
 * - "resend" o vacío: Resend (requiere dominio verificado).
 * - "log": solo en local; escribe el correo en los logs de la función.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const delivery = Deno.env.get("EMAIL_DELIVERY");
  if (delivery === "log") {
    console.info(
      JSON.stringify({
        event: "email.logged",
        to: message.to,
        cc: message.cc,
        subject: message.subject,
        text: message.text,
        attachments: message.attachments?.map((file) => file.filename),
      }),
    );
    return;
  }
  const from = Deno.env.get("EMAIL_FROM");
  if (!from) {
    throw new AppError(
      503,
      "email_unavailable",
      "Email delivery is not configured.",
    );
  }
  if (delivery === "gmail") {
    await sendWithGmail({ from, ...message });
    return;
  }
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new AppError(
      503,
      "email_unavailable",
      "Email delivery is not configured.",
    );
  }
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        cc: message.cc ? [message.cc] : undefined,
        reply_to: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map((file) => ({
          filename: file.filename,
          content: encodeBase64(file.content),
        })),
      }),
    });
  } catch (error) {
    console.error("Email delivery request failed", error);
    throw new AppError(503, "email_unavailable", "Email could not be sent.");
  }
  if (!response.ok) {
    console.error(
      "Email delivery was rejected",
      response.status,
      await response.text().catch(() => ""),
    );
    throw new AppError(503, "email_unavailable", "Email could not be sent.");
  }
}

export function registrationCodeEmail(
  to: string,
  givenNames: string,
  code: string,
  minutes: number,
): EmailMessage {
  const subject = `${code} es tu código de verificación de Chancón`;
  const text = [
    `Hola, ${givenNames}:`,
    "",
    `Tu código para verificar tu correo en Chancón es ${code}.`,
    `Vence en ${minutes} minutos.`,
    "",
    "Si no intentaste registrarte, ignora este correo.",
  ].join("\n");
  const html = `<p>Hola, ${escapeHtml(givenNames)}:</p>
<p>Tu código para verificar tu correo en Chancón es:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>
<p>Vence en ${minutes} minutos.</p>
<p style="color:#64748b">Si no intentaste registrarte, ignora este correo.</p>`;
  return { to, subject, text, html };
}

export function emailChangeCodeEmail(
  to: string,
  givenNames: string,
  code: string,
  minutes: number,
): EmailMessage {
  const subject = `${code} es tu código para cambiar tu correo en Chancón`;
  const text = [
    `Hola, ${givenNames}:`,
    "",
    `Tu código para usar este correo en tu cuenta de Chancón es ${code}.`,
    `Vence en ${minutes} minutos.`,
    "",
    "Si no pediste este cambio, ignora este correo.",
  ].join("\n");
  const html = `<p>Hola, ${escapeHtml(givenNames)}:</p>
<p>Tu código para usar este correo en tu cuenta de Chancón es:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>
<p>Vence en ${minutes} minutos.</p>
<p style="color:#64748b">Si no pediste este cambio, ignora este correo.</p>`;
  return { to, subject, text, html };
}

export function passwordResetEmail(
  to: string,
  givenNames: string,
  link: string,
  minutes: number,
): EmailMessage {
  const subject = "Restablece tu contraseña de Chancón";
  const text = [
    `Hola, ${givenNames}:`,
    "",
    "Para crear una nueva contraseña, abre este link:",
    link,
    "",
    `El link vence en ${minutes} minutos y solo se puede usar una vez.`,
    "Si no lo pediste, ignora este correo: tu contraseña no cambiará.",
  ].join("\n");
  const html = `<p>Hola, ${escapeHtml(givenNames)}:</p>
<p>Para crear una nueva contraseña, haz clic en el botón:</p>
<p><a href="${
    escapeHtml(link)
  }" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#4f46e5;color:#ffffff;font-weight:bold;text-decoration:none">Restablecer contraseña</a></p>
<p style="color:#64748b">O copia este link en tu navegador:<br>${
    escapeHtml(link)
  }</p>
<p>El link vence en ${minutes} minutos y solo se puede usar una vez.</p>
<p style="color:#64748b">Si no lo pediste, ignora este correo: tu contraseña no cambiará.</p>`;
  return { to, subject, text, html };
}

export function invitationEmail(
  to: string,
  collegeName: string,
  link: string,
  expiresAt: string,
): EmailMessage {
  const deadline = new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeZone: "America/Lima",
  }).format(new Date(expiresAt));
  const subject = `${collegeName} te invita a Chancón`;
  const text = [
    "Hola:",
    "",
    `${collegeName} te invitó a usar Chancón para practicar y repasar.`,
    "Para crear tu cuenta, abre este link y completa tus datos:",
    link,
    "",
    `La invitación vence el ${deadline} y solo se puede usar una vez.`,
    "Si no esperabas esta invitación, ignora este correo.",
  ].join("\n");
  const html = `<p>Hola:</p>
<p><strong>${
    escapeHtml(collegeName)
  }</strong> te invitó a usar Chancón para practicar y repasar.</p>
<p><a href="${
    escapeHtml(link)
  }" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#4f46e5;color:#ffffff;font-weight:bold;text-decoration:none">Crear mi cuenta</a></p>
<p style="color:#64748b">O copia este link en tu navegador:<br>${
    escapeHtml(link)
  }</p>
<p>La invitación vence el ${deadline} y solo se puede usar una vez.</p>
<p style="color:#64748b">Si no esperabas esta invitación, ignora este correo.</p>`;
  return { to, subject, text, html };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]!);
}
