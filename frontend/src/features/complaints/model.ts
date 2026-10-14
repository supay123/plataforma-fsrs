import { BUSINESS } from "../../config/business";

export const DOCUMENT_TYPES = [
  { value: "DNI", label: "DNI" },
  { value: "CE", label: "Carné de extranjería" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "RUC", label: "RUC" },
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number]["value"];

// Debe coincidir con ComplaintData en supabase/functions/_shared/complaints.ts,
// que valida la hoja, genera el PDF y la envía.
export interface ComplaintData {
  consumer_name: string;
  consumer_document_type: DocumentType;
  consumer_document_number: string;
  consumer_address: string;
  consumer_department: string;
  consumer_province: string;
  consumer_district: string;
  consumer_phone: string | null;
  consumer_email: string;
  is_minor: boolean;
  guardian_name: string | null;
  guardian_document_type: DocumentType | null;
  guardian_document_number: string | null;
  item_type: "producto" | "servicio";
  item_description: string;
  claimed_amount: number | null;
  kind: "reclamo" | "queja";
  detail: string;
  consumer_request: string;
}

/**
 * sheetNumber es el correlativo que asigna el servidor, o null en modo prueba
 */
export interface ComplaintRecord { sheetNumber: number | null; createdAt: string; data: ComplaintData }
export interface ComplaintSection { title: string; rows: Array<[string, string]> }

export function formatSheetNumber(sheetNumber: number | null) {
  return sheetNumber === null ? "PRUEBA" : String(sheetNumber).padStart(9, "0");
}

export function isTestSheet(record: ComplaintRecord) {
  return record.sheetNumber === null;
}

export function sheetLabel(record: ComplaintRecord) {
  return `${BUSINESS.complaintsBookCode}-${formatSheetNumber(record.sheetNumber)}`;
}

export function complaintPdfFilename(record: ComplaintRecord) {
  return `hoja-reclamacion-${sheetLabel(record)}.pdf`;
}

/** Domicilio completo: dirección, distrito, provincia y departamento. */
export function fullAddress(data: ComplaintData) {
  return [data.consumer_address, data.consumer_district, data.consumer_province, data.consumer_department].filter(Boolean).join(", ");
}

const documentLabel = (type: DocumentType | null) => DOCUMENT_TYPES.find((item) => item.value === type)?.label ?? "";
const present = (rows: Array<[string, string | null]>) => rows.filter((row): row is [string, string] => Boolean(row[1]));

export function complaintSections({ data }: ComplaintRecord): ComplaintSection[] {
  return [
    { title: "1. Identificación del consumidor reclamante", rows: present([
      ["Nombre completo", data.consumer_name],
      ["Documento", `${documentLabel(data.consumer_document_type)} ${data.consumer_document_number}`],
      ["Domicilio", fullAddress(data)],
      ["Teléfono", data.consumer_phone],
      ["Correo electrónico", data.consumer_email],
      ["Padre, madre o apoderado", data.is_minor ? `${data.guardian_name} (${documentLabel(data.guardian_document_type)} ${data.guardian_document_number})` : null],
    ]) },
    { title: "2. Identificación del bien contratado", rows: present([
      ["Tipo de bien", data.item_type === "servicio" ? "Servicio" : "Producto"],
      ["Descripción", data.item_description],
      ["Monto reclamado", data.claimed_amount === null ? null : `S/ ${data.claimed_amount.toFixed(2)}`],
    ]) },
    { title: "3. Detalle de la reclamación y pedido del consumidor", rows: [
      ["Tipo", data.kind === "reclamo" ? "Reclamo" : "Queja"],
      ["Detalle", data.detail],
      ["Pedido", data.consumer_request],
    ] },
  ];
}
