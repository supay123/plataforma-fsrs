import { BUSINESS } from "../../config/business";
import type { GState as GStateClass, jsPDF } from "jspdf";
import { COMPLAINT_NOTES, formatComplaintDate, formatSheetNumber, fullAddress, isTestSheet, sheetLabel, type ComplaintRecord } from "./model";

// Reproduce el formato de Hoja de Reclamación del Anexo I del Reglamento del
// Libro de Reclamaciones. Medidas en milímetros sobre A4.
const X = 12;
const W = 186;
const TOP = 12;
const BOTTOM = 285;
const LINE = 4;
const PAD = 2;

export function complaintPdfFilename(record: ComplaintRecord) {
  return `hoja-reclamacion-${sheetLabel(record)}.pdf`;
}

/** Marca cada página de una hoja de prueba para que no se confunda con un reclamo real. */
function watermark(doc: jsPDF, GState: typeof GStateClass) {
  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.15 }));
    doc.setFont("helvetica", "bold").setFontSize(110).setTextColor(220, 38, 38);
    doc.text("PRUEBA", 38, 215, { angle: 40 });
    doc.setFontSize(14).text("HOJA DE PRUEBA - SIN VALOR LEGAL", 105, 292, { align: "center" });
    doc.restoreGraphicsState();
  }
}

async function renderSheet(record: ComplaintRecord) {
  const { jsPDF, GState } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setLineWidth(0.25).setDrawColor(90).setTextColor(20);
  let y = TOP;

  const ensure = (height: number) => { if (y + height > BOTTOM) { doc.addPage(); y = TOP; } };
  const box = (x: number, top: number, w: number, h: number, fill = false) => {
    if (fill) doc.setFillColor(217, 217, 217);
    doc.rect(x, top, w, h, fill ? "FD" : "S");
  };
  const label = (text: string, x: number, top: number, size = 8, align: "left" | "center" | "right" = "left") =>
    doc.setFont("helvetica", "bold").setFontSize(size).text(text, x, top + 4.6, { align });
  const wrap = (text: string, width: number, size = 9): string[] => doc.setFont("helvetica", "normal").setFontSize(size).splitTextToSize(text, width);
  const lines = (text: string[], x: number, top: number, size = 9) => doc.setFont("helvetica", "normal").setFontSize(size).text(text, x, top + 4.6, { lineHeightFactor: 1.15 });
  const textHeight = (count: number) => Math.max(7, count * LINE + 3);

  /** Fila con etiqueta a la izquierda y valor (que puede ocupar varias líneas) a la derecha. */
  const field = (name: string, value: string, labelWidth = 34) => {
    const content = wrap(value, W - labelWidth - PAD * 2);
    const h = textHeight(content.length);
    ensure(h);
    box(X, y, labelWidth, h);
    box(X + labelWidth, y, W - labelWidth, h);
    label(name, X + PAD, y);
    lines(content, X + labelWidth + PAD, y);
    y += h;
  };
  /** keep: alto mínimo del contenido que debe quedar en la misma página que el título. */
  const sectionHeader = (title: string, keep = 7) => {
    ensure(6.5 + keep);
    box(X, y, W, 6.5, true);
    doc.setFont("helvetica", "bold").setFontSize(8.5).text(title, X + PAD, y + 4.5);
    y += 6.5;
  };
  const mark = (checked: boolean, x: number, top: number, w: number, h: number) => {
    box(x, top, w, h);
    if (checked) label("X", x + w / 2, top + (h - 7) / 2, 10, "center");
  };

  // Encabezado.
  const left = 130;
  const right = W - left;
  box(X, y, left, 8, true);
  label("LIBRO DE RECLAMACIONES", X + left / 2, y + 0.6, 11, "center");
  box(X + left, y, right, 8);
  label("HOJA DE RECLAMACIÓN", X + left + right / 2, y + 0.6, 10, "center");
  y += 8;
  box(X, y, left, 8);
  label("FECHA:", X + PAD, y + 0.6);
  lines([formatComplaintDate(record.createdAt)], X + 16, y + 0.6);
  box(X + left, y, right, 8);
  label("N°", X + left + PAD, y + 0.6, 9);
  doc.setFont("helvetica", "normal").setFontSize(9).text(`${BUSINESS.complaintsBookCode}  -  ${formatSheetNumber(record.sheetNumber)}`, X + left + 10, y + 5.2);
  y += 8;

  // Datos del proveedor.
  const providerRows: Array<[string, string]> = [
    ["PROVEEDOR:", BUSINESS.legalName],
    ["NOMBRE COMERCIAL:", BUSINESS.tradeName],
    ["RUC:", BUSINESS.ruc],
    ["DOMICILIO:", BUSINESS.address],
  ];
  const providerLines = providerRows.map(([name, value]) => [name, wrap(value, W - 40)] as const);
  const providerHeight = providerLines.reduce((sum, [, value]) => sum + value.length * LINE, 0) + 3;
  box(X, y, W, providerHeight);
  let rowTop = y + 0.5;
  for (const [name, value] of providerLines) {
    doc.setFont("helvetica", "bold").setFontSize(8).text(name, X + PAD, rowTop + 3.2);
    doc.setFont("helvetica", "normal").setFontSize(9).text(value, X + 38, rowTop + 3.2, { lineHeightFactor: 1.15 });
    rowTop += value.length * LINE;
  }
  y += providerHeight;

  // 1. Consumidor.
  const { data } = record;
  sectionHeader("1. IDENTIFICACIÓN DEL CONSUMIDOR RECLAMANTE");
  field("NOMBRE:", data.consumer_name);
  field("DNI / CE:", `${data.consumer_document_type} ${data.consumer_document_number}`);
  field("DOMICILIO:", fullAddress(data));
  const emailLines = wrap(data.consumer_email, 64);
  const contactHeight = textHeight(emailLines.length);
  ensure(contactHeight);
  box(X, y, 34, contactHeight);
  label("TELÉFONO:", X + PAD, y);
  box(X + 34, y, 64, contactHeight);
  lines([data.consumer_phone ?? ""], X + 34 + PAD, y);
  box(X + 98, y, 20, contactHeight);
  label("E-MAIL:", X + 98 + PAD, y);
  box(X + 118, y, W - 118, contactHeight);
  lines(emailLines, X + 118 + PAD, y);
  y += contactHeight;
  ensure(14);
  box(X, y, W, 7);
  label("SI ES MENOR DE EDAD, NOMBRE DEL PADRE, MADRE O APODERADO:", X + PAD, y);
  y += 7;
  box(X, y, W, 7);
  if (data.is_minor) lines([`${data.guardian_name} (${data.guardian_document_type} ${data.guardian_document_number})`], X + PAD, y);
  y += 7;

  // 2. Bien contratado.
  sectionHeader("2. IDENTIFICACIÓN DEL BIEN CONTRATADO");
  const amount = data.claimed_amount === null ? "" : `S/ ${data.claimed_amount.toFixed(2)}`;
  const description = wrap(data.item_description, W - 96 - PAD * 2);
  const itemRows: Array<[string, boolean, string, string[]]> = [
    ["PRODUCTO", data.item_type === "producto", "MONTO RECLAMADO:", [amount]],
    ["SERVICIO", data.item_type === "servicio", "DESCRIPCIÓN:", description],
  ];
  for (const [name, checked, detailName, detail] of itemRows) {
    const h = textHeight(detail.length);
    ensure(h);
    box(X, y, 34, h);
    label(name, X + PAD, y);
    mark(checked, X + 34, y, 12, h);
    box(X + 46, y, 50, h);
    label(detailName, X + 46 + PAD, y);
    box(X + 96, y, W - 96, h);
    lines(detail, X + 96 + PAD, y);
    y += h;
  }

  // 3. Detalle y pedido.
  ensure(14);
  box(X, y, 120, 7, true);
  doc.setFont("helvetica", "bold").setFontSize(8.5).text("3. DETALLE DE LA RECLAMACIÓN", X + PAD, y + 4.7);
  box(X + 120, y, 24, 7);
  label("RECLAMO¹", X + 132, y, 8, "center");
  mark(data.kind === "reclamo", X + 144, y, 9, 7);
  box(X + 153, y, 24, 7);
  label("QUEJA²", X + 165, y, 8, "center");
  mark(data.kind === "queja", X + 177, y, 9, 7);
  y += 7;

  const detail = wrap(data.detail, W - PAD * 2);
  const detailHeight = Math.max(30, detail.length * LINE + 10);
  ensure(detailHeight);
  box(X, y, W, detailHeight);
  label("DETALLE:", X + PAD, y);
  lines(detail, X + PAD, y + 5);
  y += detailHeight;

  const request = wrap(data.consumer_request, 116);
  const requestHeight = Math.max(32, request.length * LINE + 10);
  ensure(requestHeight);
  box(X, y, 120, requestHeight);
  label("PEDIDO:", X + PAD, y);
  lines(request, X + PAD, y + 5);
  box(X + 120, y, W - 120, requestHeight - 7);
  lines(wrap(`Hoja presentada virtualmente por ${data.consumer_name}, quien declaró que la información consignada es veraz.`, W - 124, 7.5), X + 122, y, 7.5);
  box(X + 120, y + requestHeight - 7, W - 120, 7);
  label("FIRMA DEL CONSUMIDOR", X + 120 + (W - 120) / 2, y + requestHeight - 7, 8, "center");
  y += requestHeight;

  // 4. Respuesta del proveedor (se completa al responder).
  sectionHeader("4. OBSERVACIONES Y ACCIONES ADOPTADAS POR EL PROVEEDOR", 35);
  box(X, y, 74, 7);
  label("FECHA DE COMUNICACIÓN DE LA RESPUESTA:", X + PAD, y);
  box(X + 74, y, 46, 7);
  box(X, y + 7, 120, 28);
  box(X + 120, y, W - 120, 28);
  box(X + 120, y + 28, W - 120, 7);
  label("FIRMA DEL PROVEEDOR", X + 120 + (W - 120) / 2, y + 28, 8, "center");
  y += 35;

  // Definiciones y notas legales.
  const claimNote = wrap(`¹ ${COMPLAINT_NOTES[0]}`, W / 2 - PAD * 2, 7);
  const complaintNote = wrap(`² ${COMPLAINT_NOTES[1]}`, W / 2 - PAD * 2, 7);
  const notesHeight = Math.max(claimNote.length, complaintNote.length) * 3.2 + 3;
  ensure(notesHeight + 20);
  box(X, y, W / 2, notesHeight);
  box(X + W / 2, y, W / 2, notesHeight);
  doc.setFont("helvetica", "normal").setFontSize(7).text(claimNote, X + PAD, y + 3.6, { lineHeightFactor: 1.15 });
  doc.text(complaintNote, X + W / 2 + PAD, y + 3.6, { lineHeightFactor: 1.15 });
  y += notesHeight;
  box(X + 86, y, W - 86, 7, true);
  label("HOJA DE RECLAMACIÓN VIRTUAL", X + W - PAD, y, 10, "right");
  y += 9;
  for (const note of COMPLAINT_NOTES.slice(2)) {
    const noteLines = wrap(`* ${note}`, W, 7);
    doc.setFont("helvetica", "normal").setFontSize(7).text(noteLines, X, y + 2.5, { lineHeightFactor: 1.15 });
    y += noteLines.length * 3.2;
  }
  if (isTestSheet(record)) watermark(doc, GState);
  return doc;
}

export async function complaintPdfBlob(record: ComplaintRecord) {
  return (await renderSheet(record)).output("blob");
}

export async function downloadComplaintPdf(record: ComplaintRecord) {
  (await renderSheet(record)).save(complaintPdfFilename(record));
}
