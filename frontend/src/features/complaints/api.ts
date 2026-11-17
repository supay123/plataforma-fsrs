import { invokeFunction } from "../../lib/api/functions";
import type { ComplaintData } from "./model";

/** Tope para la evidencia del consumidor. Debe coincidir con EVIDENCE_MAX_BYTES en supabase/functions/_shared/complaints.ts. */
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;

/** sheet_number es null en una hoja de prueba; pdf es la hoja en base64. */
export interface SentComplaint { sheet_number: number | null; submitted_at: string; pdf: string }

/**
 * El servidor numera la hoja, genera el PDF y la envía por correo al negocio con
 * copia al consumidor. retrySheetNumber reutiliza el número de un envío que
 * falló, para no dejar huecos en la numeración.
 */
export function sendComplaint(data: ComplaintData, options: { test: boolean; evidence: File[]; retrySheetNumber: number | null }) {
  const form = new FormData();
  form.append("data", JSON.stringify(data));
  if (options.test) form.append("test", "true");
  if (options.retrySheetNumber !== null) form.append("sheet_number", String(options.retrySheetNumber));
  options.evidence.forEach((file) => form.append("evidence", file, file.name));
  return invokeFunction<SentComplaint, FormData>("complaints/sheets", form);
}

export function pdfFromBase64(base64: string) {
  return new Blob([Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))], { type: "application/pdf" });
}
