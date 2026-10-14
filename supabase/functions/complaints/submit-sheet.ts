import { RPCS } from "../_shared/database.constants.ts";
import { renderComplaintPdf } from "../_shared/complaint-pdf.ts";
import {
  clientIp,
  complaintEmail,
  type ComplaintData,
  type ComplaintRecord,
  EVIDENCE_MAX_BYTES,
  parseComplaintData,
  parseEvidence,
} from "../_shared/complaints.ts";
import { sendEmail } from "../_shared/email.ts";
import { AppError, json } from "../_shared/errors.ts";
import { encodeBase64 } from "../_shared/gmail.ts";
import type { EdgeContext } from "../_shared/types.ts";

/** Hojas con número que cada IP puede enviar por día (hora de Lima). */
const DAILY_LIMIT = 2;
// La evidencia más la hoja y el margen del multipart.
const REQUEST_MAX_BYTES = EVIDENCE_MAX_BYTES + 1024 * 1024;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")).join("");
}

function retrySheetNumber(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new AppError(400, "validation_error", "sheet_number is not valid.");
  }
  return number;
}

/** Numera la hoja. Un reintento con el número de un envío fallido lo reutiliza. */
async function reserveSheet(
  request: Request,
  context: EdgeContext,
  retry: number | null,
  data: ComplaintData,
): Promise<ComplaintRecord> {
  const { data: reserved, error } = await context.supabaseAdmin.rpc(
    RPCS.reserveComplaintSheet,
    {
      p_ip_hash: await sha256(clientIp(request)),
      p_daily_limit: DAILY_LIMIT,
      ...(retry === null ? {} : { p_retry_sheet_number: retry }),
    },
  );
  if (error?.message === "complaint_daily_limit") {
    throw new AppError(
      429,
      "complaint_daily_limit",
      "The daily complaint limit was reached.",
    );
  }
  if (error || !reserved) {
    throw new AppError(
      500,
      "complaint_number_failed",
      "The complaint number could not be assigned.",
    );
  }
  const sheet = reserved as { sheet_number: number; submitted_at: string };
  return {
    sheetNumber: sheet.sheet_number,
    createdAt: sheet.submitted_at,
    data,
  };
}

/**
 * POST /complaints/sheets (multipart/form-data)
 * data: la hoja en JSON; evidence: imágenes o PDF (opcional, varios);
 * test: "true" para una hoja de prueba, sin número ni límite por IP;
 * sheet_number: el número de un envío que falló, para reintentarlo.
 * Responde con el número, la fecha oficial y la hoja en PDF (base64).
 */
export async function submitSheet(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? 0) > REQUEST_MAX_BYTES) {
    throw new AppError(413, "attachments_too_large", "The request is too large.");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new AppError(
      400,
      "invalid_form",
      "The request body must be multipart/form-data.",
    );
  }
  let input: unknown;
  try {
    input = JSON.parse(String(form.get("data") ?? ""));
  } catch {
    throw new AppError(400, "validation_error", "The complaint is required.");
  }
  const data = parseComplaintData(input);
  const evidence = await parseEvidence(form.getAll("evidence"));
  const test = form.get("test") === "true";
  const record: ComplaintRecord = test
    ? { sheetNumber: null, createdAt: new Date().toISOString(), data }
    : await reserveSheet(
      request,
      context,
      retrySheetNumber(form.get("sheet_number")),
      data,
    );

  const pdf = renderComplaintPdf(record);
  try {
    await sendEmail(complaintEmail(record, pdf, evidence));
  } catch (error) {
    console.error("Complaint email failed", record.sheetNumber, error);
    throw new AppError(
      503,
      "complaint_not_sent",
      "The complaint could not be sent.",
      { sheet_number: record.sheetNumber },
    );
  }
  if (record.sheetNumber !== null) {
    const { error } = await context.supabaseAdmin.rpc(
      RPCS.markComplaintSheetSent,
      { p_sheet_number: record.sheetNumber },
    );
    // La hoja ya se envió; solo quedaría disponible para un reintento.
    if (error) console.error("Complaint sheet mark failed", error);
  }
  return json({
    sheet_number: record.sheetNumber,
    submitted_at: record.createdAt,
    pdf: encodeBase64(pdf),
  });
}
