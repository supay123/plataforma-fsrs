import { describe, expect, it } from "vitest";
import { complaintPdfFilename, complaintSections, formatSheetNumber, sheetLabel, type ComplaintData } from "./model";

const data: ComplaintData = {
  consumer_name: "Ana Pérez", consumer_document_type: "DNI", consumer_document_number: "12345678",
  consumer_address: "Av. Lima 123", consumer_department: "Lima", consumer_province: "Lima", consumer_district: "Miraflores", consumer_phone: null, consumer_email: "ana@example.com",
  is_minor: true, guardian_name: "Luis Pérez", guardian_document_type: "DNI", guardian_document_number: "87654321",
  item_type: "servicio", item_description: "Plan Estudiante", claimed_amount: null,
  kind: "queja", detail: "Demora en la atención.", consumer_request: "Mejor atención.",
};
const record = { sheetNumber: 42, createdAt: "2026-10-09T15:00:00.000Z", data };

describe("complaint model", () => {
  it("formats the sheet number with the book code and a padded correlative", () => {
    expect(formatSheetNumber(1)).toBe("000000001");
    expect(sheetLabel(record)).toBe("001-000000042");
    expect(sheetLabel({ ...record, sheetNumber: null })).toBe("001-PRUEBA");
    expect(complaintPdfFilename(record)).toBe("hoja-reclamacion-001-000000042.pdf");
  });

  it("keeps provider data out of the consumer sections", () => {
    const labels = complaintSections(record).flatMap((section) => section.rows.map(([label]) => label));
    expect(labels).not.toContain("RUC");
  });

  it("omits empty optional rows and keeps labels unique", () => {
    const sections = complaintSections(record);
    const labels = sections.flatMap((section) => section.rows.map(([label]) => label));
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).not.toContain("Teléfono");
    expect(labels).not.toContain("Monto reclamado");
    expect(Object.fromEntries(sections.flatMap((section) => section.rows))).toMatchObject({
      "Padre, madre o apoderado": "Luis Pérez (DNI 87654321)",
      Tipo: "Queja",
    });
  });
});
