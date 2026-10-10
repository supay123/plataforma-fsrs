import { BUSINESS } from "../../config/business";
import { AppError } from "../../lib/api/errors";
import { invokeFunction } from "../../lib/api/functions";
import { complaintSections, isTestSheet, providerRows, sheetLabel, type ComplaintRecord } from "./model";

export interface AssignedComplaintNumber { sheet_number: number; submitted_at: string }

/** Reserva el siguiente correlativo y devuelve la fecha y hora oficiales de presentación. */
export function assignComplaintNumber() {
  return invokeFunction<AssignedComplaintNumber, Record<string, never>>("assign-complaint-number", {});
}

// FormSubmit reenvía cada hoja al correo del negocio con copia al consumidor. La
// primera vez envía a ese correo un enlace de activación que hay que confirmar.
const FORMSUBMIT_URL = `https://formsubmit.co/ajax/${BUSINESS.email}`;
// FormSubmit acepta como máximo 10 MB sumando todos los archivos, incluida la hoja en PDF.
const FORMSUBMIT_MAX_BYTES = 10 * 1024 * 1024;
/** Tope para la evidencia del consumidor; el resto queda libre para el PDF de la hoja. */
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;

export async function sendComplaint(record: ComplaintRecord, pdf: Blob, filename: string, evidence: File[] = []) {
  if (evidence.reduce((total, file) => total + file.size, pdf.size) > FORMSUBMIT_MAX_BYTES) {
    throw new AppError("attachments_too_large", "Los archivos adjuntos superan el tamaño permitido. Quita alguno e inténtalo de nuevo.");
  }
  const kind = record.data.kind === "reclamo" ? "Reclamo" : "Queja";
  const form = new FormData();
  const test = isTestSheet(record);
  form.append("_subject", `${test ? "[PRUEBA] " : ""}Libro de reclamaciones: ${kind} N.° ${sheetLabel(record)}`);
  form.append("_template", "table");
  form.append("_captcha", "false");
  form.append("_replyto", record.data.consumer_email);
  form.append("_cc", record.data.consumer_email);
  if (test) form.append("Modo prueba", "Hoja de prueba: no es un reclamo real y no tiene número correlativo.");
  form.append("N.° de hoja", sheetLabel(record));
  const rows = [...providerRows(record.createdAt), ...complaintSections(record).flatMap((section) => section.rows)];
  for (const [label, value] of rows) form.append(label, value);
  if (evidence.length) form.append("Evidencia adjunta", evidence.map((file) => file.name).join(", "));
  form.append("attachment", pdf, filename);
  evidence.forEach((file, index) => form.append(`evidencia_${index + 1}`, file, file.name));
  let response: Response;
  try {
    response = await fetch(FORMSUBMIT_URL, { method: "POST", headers: { Accept: "application/json" }, body: form });
  } catch {
    throw new AppError("network_error", "No se pudo conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.");
  }
  const body: { success?: string | boolean } | null = await response.json().catch(() => null);
  if (!response.ok || String(body?.success) !== "true") {
    throw new AppError("complaint_failed", "No se pudo enviar tu reclamo. Inténtalo de nuevo o escríbenos por WhatsApp.");
  }
}
