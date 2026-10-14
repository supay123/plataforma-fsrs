import assert from "node:assert/strict";
import { renderComplaintPdf } from "../complaint-pdf.ts";
import {
  clientIp,
  complaintEmail,
  type ComplaintData,
  parseComplaintData,
  parseEvidence,
  sheetLabel,
} from "../complaints.ts";
import { AppError } from "../errors.ts";

const data: ComplaintData = {
  consumer_name: "Ana Pérez",
  consumer_document_type: "DNI",
  consumer_document_number: "12345678",
  consumer_address: "Av. Lima 123",
  consumer_department: "Lima",
  consumer_province: "Lima",
  consumer_district: "Miraflores",
  consumer_phone: null,
  consumer_email: "ana@example.com",
  is_minor: false,
  guardian_name: null,
  guardian_document_type: null,
  guardian_document_number: null,
  item_type: "servicio",
  item_description: "Plan Estudiante",
  claimed_amount: 14.9,
  kind: "reclamo",
  detail: "Se me cobró dos veces.",
  consumer_request: "Devolución del cobro duplicado.",
};
const record = { sheetNumber: 7, createdAt: "2026-10-09T15:00:00.000Z", data };

function validationField(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "validation_error");
    return (error.details as { field?: string } | undefined)?.field;
  }
  assert.fail("Expected a validation error.");
}

Deno.test("parses a complaint and drops guardian data for adults", () => {
  const parsed = parseComplaintData({
    ...data,
    consumer_name: "  Ana Pérez ",
    consumer_phone: "",
    guardian_name: "Ignorado",
  });
  assert.equal(parsed.consumer_name, "Ana Pérez");
  assert.equal(parsed.consumer_phone, null);
  assert.equal(parsed.guardian_name, null);
});

Deno.test("rejects invalid complaint fields with the field name", () => {
  assert.equal(validationField(() => parseComplaintData({ ...data, consumer_email: "ana" })), "consumer_email");
  assert.equal(validationField(() => parseComplaintData({ ...data, kind: "otro" })), "kind");
  assert.equal(validationField(() => parseComplaintData({ ...data, claimed_amount: 1.234 })), "claimed_amount");
  assert.equal(validationField(() => parseComplaintData({ ...data, detail: "x".repeat(3001) })), "detail");
  assert.equal(
    validationField(() => parseComplaintData({ ...data, is_minor: true, guardian_document_type: "DNI", guardian_document_number: "1" })),
    "guardian_name",
  );
});

Deno.test("emails real sheets to the business with a copy to the consumer", () => {
  const evidence = [{ filename: "voucher.pdf", contentType: "application/pdf", content: new Uint8Array([1]) }];
  const email = complaintEmail(record, new Uint8Array([2]), evidence);
  assert.equal(email.to, "pesupay@gmail.com");
  assert.equal(email.cc, "ana@example.com");
  assert.equal(email.replyTo, "ana@example.com");
  assert.equal(email.subject, "Libro de reclamaciones: Reclamo N.° 001-000000007");
  assert.deepEqual(email.attachments?.map((file) => file.filename), [
    "hoja-reclamacion-001-000000007.pdf",
    "voucher.pdf",
  ]);
  assert.ok(email.text.includes("RUC: 10774172578"));
  assert.ok(email.html.includes("Ana P&eacute;rez") || email.html.includes("Ana Pérez"));
});

Deno.test("sends test sheets only to the business", () => {
  const test = { ...record, sheetNumber: null };
  assert.equal(sheetLabel(test), "001-PRUEBA");
  const email = complaintEmail(test, new Uint8Array([2]), []);
  assert.equal(email.cc, undefined);
  assert.ok(email.subject.startsWith("[PRUEBA] "));
});

Deno.test("escapes consumer text in the HTML email", () => {
  const email = complaintEmail({ ...record, data: { ...data, detail: "<script>x</script>" } }, new Uint8Array(), []);
  assert.ok(!email.html.includes("<script>"));
});

Deno.test("renders the sheet as a PDF", () => {
  const pdf = renderComplaintPdf({ ...record, data: { ...data, detail: "Detalle largo. ".repeat(300) } });
  assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
  assert.ok(renderComplaintPdf({ ...record, sheetNumber: null }).length > 1000);
});

Deno.test("accepts images and PDFs as evidence within the size limit", async () => {
  const files = await parseEvidence([
    new File(["img"], "captura.png", { type: "image/png" }),
    new File(["%PDF"], "voucher.pdf", { type: "application/pdf" }),
  ]);
  assert.deepEqual(files.map((file) => file.filename), ["captura.png", "voucher.pdf"]);
  await assert.rejects(
    parseEvidence([new File(["x"], "a.exe", { type: "application/octet-stream" })]),
    (error: AppError) => error.code === "invalid_evidence",
  );
  await assert.rejects(
    parseEvidence([new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })]),
    (error: AppError) => error.code === "attachments_too_large",
  );
  await assert.rejects(parseEvidence(["texto"]), (error: AppError) => error.code === "invalid_evidence");
});

Deno.test("prefers the Cloudflare client IP over X-Forwarded-For", () => {
  assert.equal(
    clientIp(new Request("http://x", { headers: { "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "9.9.9.9, 2.2.2.2" } })),
    "1.1.1.1",
  );
  assert.equal(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "2.2.2.2, 3.3.3.3" } })), "2.2.2.2");
  assert.equal(clientIp(new Request("http://x")), "unknown");
});
