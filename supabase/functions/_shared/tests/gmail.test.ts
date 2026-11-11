import assert from "node:assert/strict";
import { buildMimeMessage, toBase64Url } from "../gmail.ts";

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\r\n/g, ""));
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

Deno.test("builds a UTF-8 multipart message for the Gmail API", () => {
  const raw = buildMimeMessage({
    from: "Chancón <envios@example.com>",
    to: "ana@example.com",
    subject: "123456 es tu código",
    text: "Hola, Ana María:",
    html: "<p>Hola, Ana María:</p>",
  }, "boundary-1");

  const lines = raw.split("\r\n");
  assert.match(lines[0]!, /^From: =\?UTF-8\?B\?(.+)\?= <envios@example\.com>$/);
  assert.equal(decodeBase64(lines[0]!.split("?")[3]!), "Chancón");
  assert.equal(lines[1], "To: ana@example.com");
  assert.match(lines[2]!, /^Subject: =\?UTF-8\?B\?.+\?=$/);
  assert.equal(
    decodeBase64(lines[2]!.slice("Subject: =?UTF-8?B?".length, -2)),
    "123456 es tu código",
  );
  const textPart = raw.split("--boundary-1")[1]!.split("\r\n\r\n")[1]!;
  assert.equal(decodeBase64(textPart.trim()), "Hola, Ana María:");
  assert.ok(raw.trimEnd().endsWith("--boundary-1--"));
});

Deno.test("keeps ASCII headers readable and encodes the message as base64url", () => {
  const raw = buildMimeMessage({
    from: "envios@example.com",
    to: "ana@example.com",
    subject: "Codigo",
    text: "x",
    html: "<p>x</p>",
  }, "b");
  assert.ok(raw.startsWith("From: envios@example.com\r\n"));
  assert.ok(raw.includes("\r\nSubject: Codigo\r\n"));
  assert.doesNotMatch(toBase64Url(raw), /[+/=]/);
});

Deno.test("adds copy, reply-to and attachments in a multipart/mixed message", () => {
  const raw = buildMimeMessage({
    from: "envios@example.com",
    to: "negocio@example.com",
    cc: "ana@example.com",
    replyTo: "ana@example.com",
    subject: "Reclamo",
    text: "x",
    html: "<p>x</p>",
    attachments: [{
      filename: "hoja-reclamación.pdf",
      contentType: "application/pdf",
      content: new TextEncoder().encode("%PDF-1.3"),
    }],
  }, "b");
  assert.ok(raw.includes("\r\nCc: ana@example.com\r\n"));
  assert.ok(raw.includes("\r\nReply-To: ana@example.com\r\n"));
  assert.ok(raw.includes('Content-Type: multipart/mixed; boundary="b"'));
  assert.ok(
    raw.includes('Content-Type: multipart/alternative; boundary="b-alt"'),
  );
  assert.match(
    raw,
    /Content-Disposition: attachment; filename="=\?UTF-8\?B\?.+\?="/,
  );
  const attachment = raw.split("--b\r\n")[2]!.split("\r\n\r\n")[1]!;
  assert.equal(
    decodeBase64(attachment.replace("\r\n--b--", "").trim()),
    "%PDF-1.3",
  );
});
