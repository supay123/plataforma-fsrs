import { BUSINESS } from "./business.ts";
import {
  type EmailAttachment,
  type EmailMessage,
  escapeHtml,
} from "./email.ts";
import { AppError } from "./errors.ts";
import { boolean, requiredString } from "./validation.ts";

// Hoja de Reclamación del Libro de Reclamaciones virtual. Los campos deben
// coincidir con ComplaintData en frontend/src/features/complaints/model.ts.

const DOCUMENT_TYPES = {
  DNI: "DNI",
  CE: "Carné de extranjería",
  PASAPORTE: "Pasaporte",
  RUC: "RUC",
} as const;
export type DocumentType = keyof typeof DOCUMENT_TYPES;
type GuardianDocumentType = Exclude<DocumentType, "RUC">;

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
  guardian_document_type: GuardianDocumentType | null;
  guardian_document_number: string | null;
  item_type: "producto" | "servicio";
  item_description: string;
  claimed_amount: number | null;
  kind: "reclamo" | "queja";
  detail: string;
  consumer_request: string;
}

/** sheetNumber es el correlativo asignado, o null en una hoja de prueba. */
export interface ComplaintRecord {
  sheetNumber: number | null;
  createdAt: string;
  data: ComplaintData;
}

export const COMPLAINT_NOTES = [
  "Reclamo: disconformidad relacionada con los productos o servicios.",
  "Queja: disconformidad no relacionada con los productos o servicios; o malestar o descontento respecto a la atención al público.",
  "La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.",
  "El proveedor debe dar respuesta al reclamo o queja en un plazo no mayor a quince (15) días hábiles improrrogables.",
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid(field: string, message: string): AppError {
  return new AppError(400, "validation_error", message, { field });
}

function oneOf<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw invalid(field, `${field} is not valid.`);
  }
  return value as T;
}

function text(
  input: Record<string, unknown>,
  field: keyof ComplaintData,
  maxLength: number,
): string {
  try {
    return requiredString(input[field], field, maxLength);
  } catch (error) {
    if (error instanceof AppError) throw invalid(field, error.message);
    throw error;
  }
}

function amount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "number" || !Number.isFinite(value) || value < 0 ||
    value >= 1_000_000_000 || Math.round(value * 100) !== value * 100
  ) {
    throw invalid("claimed_amount", "claimed_amount is not valid.");
  }
  return value;
}

/** Valida la hoja enviada por el formulario público. */
export function parseComplaintData(value: unknown): ComplaintData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(400, "validation_error", "The complaint is required.");
  }
  const input = value as Record<string, unknown>;
  const isMinor = boolean(input.is_minor, "is_minor");
  const phone = input.consumer_phone;
  const email = text(input, "consumer_email", 254);
  if (!EMAIL_PATTERN.test(email)) {
    throw invalid("consumer_email", "consumer_email is not valid.");
  }
  return {
    consumer_name: text(input, "consumer_name", 200),
    consumer_document_type: oneOf(
      input.consumer_document_type,
      "consumer_document_type",
      ["DNI", "CE", "PASAPORTE", "RUC"],
    ),
    consumer_document_number: text(input, "consumer_document_number", 20),
    consumer_address: text(input, "consumer_address", 300),
    consumer_department: text(input, "consumer_department", 100),
    consumer_province: text(input, "consumer_province", 100),
    consumer_district: text(input, "consumer_district", 100),
    consumer_phone: phone === null || phone === undefined || phone === ""
      ? null
      : text(input, "consumer_phone", 30),
    consumer_email: email,
    is_minor: isMinor,
    guardian_name: isMinor ? text(input, "guardian_name", 200) : null,
    guardian_document_type: isMinor
      ? oneOf<GuardianDocumentType>(
        input.guardian_document_type,
        "guardian_document_type",
        [
          "DNI",
          "CE",
          "PASAPORTE",
        ],
      )
      : null,
    guardian_document_number: isMinor
      ? text(input, "guardian_document_number", 20)
      : null,
    item_type: oneOf(input.item_type, "item_type", ["producto", "servicio"]),
    item_description: text(input, "item_description", 1000),
    claimed_amount: amount(input.claimed_amount),
    kind: oneOf(input.kind, "kind", ["reclamo", "queja"]),
    detail: text(input, "detail", 3000),
    consumer_request: text(input, "consumer_request", 2000),
  };
}

export function formatSheetNumber(sheetNumber: number | null): string {
  return sheetNumber === null ? "PRUEBA" : String(sheetNumber).padStart(9, "0");
}

export function sheetLabel(record: ComplaintRecord): string {
  return `${BUSINESS.complaintsBookCode}-${
    formatSheetNumber(record.sheetNumber)
  }`;
}

export function isTestSheet(record: ComplaintRecord): boolean {
  return record.sheetNumber === null;
}

export function complaintPdfFilename(record: ComplaintRecord): string {
  return `hoja-reclamacion-${sheetLabel(record)}.pdf`;
}

export function formatComplaintDate(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

/** Domicilio completo: dirección, distrito, provincia y departamento. */
export function fullAddress(data: ComplaintData): string {
  return [
    data.consumer_address,
    data.consumer_district,
    data.consumer_province,
    data.consumer_department,
  ].filter(Boolean).join(", ");
}

const documentLabel = (type: DocumentType | null) =>
  type ? DOCUMENT_TYPES[type] : "";

type Row = [string, string];
const present = (rows: Array<[string, string | null]>) =>
  rows.filter((row): row is Row => Boolean(row[1]));

function complaintRows(record: ComplaintRecord): Array<[string, Row[]]> {
  const { data } = record;
  return [
    ["Proveedor", [
      ["Razón social", BUSINESS.legalName],
      ["Nombre comercial", BUSINESS.tradeName],
      ["RUC", BUSINESS.ruc],
      ["Domicilio fiscal", BUSINESS.address],
      ["N.° de hoja", sheetLabel(record)],
      ["Fecha", formatComplaintDate(record.createdAt)],
    ]],
    [
      "1. Identificación del consumidor reclamante",
      present([
        ["Nombre completo", data.consumer_name],
        [
          "Documento",
          `${
            documentLabel(data.consumer_document_type)
          } ${data.consumer_document_number}`,
        ],
        ["Domicilio", fullAddress(data)],
        ["Teléfono", data.consumer_phone],
        ["Correo electrónico", data.consumer_email],
        [
          "Padre, madre o apoderado",
          data.is_minor
            ? `${data.guardian_name} (${
              documentLabel(data.guardian_document_type)
            } ${data.guardian_document_number})`
            : null,
        ],
      ]),
    ],
    [
      "2. Identificación del bien contratado",
      present([
        [
          "Tipo de bien",
          data.item_type === "servicio" ? "Servicio" : "Producto",
        ],
        ["Descripción", data.item_description],
        [
          "Monto reclamado",
          data.claimed_amount === null
            ? null
            : `S/ ${data.claimed_amount.toFixed(2)}`,
        ],
      ]),
    ],
    ["3. Detalle de la reclamación y pedido del consumidor", [
      ["Tipo", data.kind === "reclamo" ? "Reclamo" : "Queja"],
      ["Detalle", data.detail],
      ["Pedido", data.consumer_request],
    ]],
  ];
}

/**
 * Correo con la hoja en PDF y la evidencia. Va al negocio con copia al
 * consumidor; una hoja de prueba solo va al negocio, para que el modo prueba
 * (sin límite de envíos) no sirva para mandar correos a terceros.
 */
export function complaintEmail(
  record: ComplaintRecord,
  pdf: Uint8Array,
  evidence: EmailAttachment[],
): EmailMessage {
  const test = isTestSheet(record);
  const kind = record.data.kind === "reclamo" ? "Reclamo" : "Queja";
  const subject = `${
    test ? "[PRUEBA] " : ""
  }Libro de reclamaciones: ${kind} N.° ${sheetLabel(record)}`;
  const sections = complaintRows(record);
  if (evidence.length) {
    sections.push([
      "Evidencia adjunta",
      evidence.map((file, index) => [`Archivo ${index + 1}`, file.filename]),
    ]);
  }
  const intro = test
    ? "Hoja de prueba: no es un reclamo real y no tiene número correlativo."
    : `Se registró una hoja en el Libro de Reclamaciones virtual de ${BUSINESS.tradeName}. Se adjunta la hoja en PDF.`;
  const text = [
    intro,
    ...sections.flatMap(([title, rows]) => [
      "",
      title.toUpperCase(),
      ...rows.map(([label, value]) => `${label}: ${value}`),
    ]),
  ].join("\n");
  const html = `<p>${escapeHtml(intro)}</p>
${
    sections.map(([title, rows]) =>
      `<h3 style="margin:20px 0 8px">${escapeHtml(title)}</h3>
<table style="border-collapse:collapse;width:100%;max-width:640px">${
        rows.map(([label, value]) =>
          `<tr><th style="border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top;width:180px;background:#f1f5f9">${
            escapeHtml(label)
          }</th><td style="border:1px solid #cbd5e1;padding:6px 8px;white-space:pre-wrap">${
            escapeHtml(value)
          }</td></tr>`
        ).join("")
      }</table>`
    ).join("\n")
  }`;
  return {
    to: BUSINESS.email,
    cc: test ? undefined : record.data.consumer_email,
    replyTo: record.data.consumer_email,
    subject,
    text,
    html,
    attachments: [
      {
        filename: complaintPdfFilename(record),
        contentType: "application/pdf",
        content: pdf,
      },
      ...evidence,
    ],
  };
}

/** Tope de la evidencia del consumidor, sumando todos sus archivos. */
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
const EVIDENCE_MAX_FILES = 10;

function evidenceTooLarge(): AppError {
  return new AppError(
    413,
    "attachments_too_large",
    `Evidence must not exceed ${EVIDENCE_MAX_BYTES} bytes.`,
  );
}

/** Evidencia del formulario: solo imágenes o PDF, dentro del tope. */
export async function parseEvidence(
  entries: FormDataEntryValue[],
): Promise<EmailAttachment[]> {
  const files = entries.filter((entry): entry is File => entry instanceof File);
  if (files.length !== entries.length || files.length > EVIDENCE_MAX_FILES) {
    throw new AppError(400, "invalid_evidence", "Evidence is not valid.");
  }
  if (
    files.some((file) =>
      !file.type.startsWith("image/") && file.type !== "application/pdf"
    )
  ) {
    throw new AppError(
      400,
      "invalid_evidence",
      "Evidence must be images or PDF files.",
    );
  }
  if (
    files.reduce((total, file) => total + file.size, 0) > EVIDENCE_MAX_BYTES
  ) {
    throw evidenceTooLarge();
  }
  return await Promise.all(files.map(async (file, index) => ({
    filename: file.name.trim() || `evidencia-${index + 1}`,
    contentType: file.type,
    content: new Uint8Array(await file.arrayBuffer()),
  })));
}

/**
 * IP del consumidor. cf-connecting-ip la fija Cloudflare, delante de Supabase,
 * y reemplaza la que mande el cliente; x-forwarded-for queda como respaldo.
 */
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
}
