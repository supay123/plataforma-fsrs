import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComplaintsBookPage } from "./ComplaintsBookPage";

const mocks = vi.hoisted(() => ({
  assignComplaintNumber: vi.fn(),
  sendComplaint: vi.fn(),
  complaintPdfBlob: vi.fn(),
  downloadComplaintPdf: vi.fn(),
}));

vi.mock("../../features/complaints/api", () => ({ EVIDENCE_MAX_BYTES: 5 * 1024 * 1024, assignComplaintNumber: mocks.assignComplaintNumber, sendComplaint: mocks.sendComplaint }));
vi.mock("../../features/complaints/pdf", () => ({
  complaintPdfBlob: mocks.complaintPdfBlob,
  complaintPdfFilename: () => "hoja.pdf",
  downloadComplaintPdf: mocks.downloadComplaintPdf,
}));

const pdf = new Blob(["%PDF"], { type: "application/pdf" });

function renderPage(path = "/libro-reclamaciones") {
  return render(<MemoryRouter initialEntries={[path]}><ComplaintsBookPage /></MemoryRouter>);
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getAllByLabelText("Nombre completo")[0]!, "Ana Pérez");
  await user.type(screen.getAllByLabelText("Número de documento")[0]!, "12345678");
  await user.type(screen.getByLabelText("Domicilio"), "Av. Lima 123");
  await user.type(screen.getByLabelText("Departamento"), "Lima");
  await user.type(screen.getByLabelText("Provincia"), "Lima");
  await user.type(screen.getByLabelText("Distrito"), "Miraflores");
  await user.type(screen.getByRole("textbox", { name: "Correo electrónico" }), "ana@example.com");
  await user.type(screen.getByLabelText("Descripción"), "Plan mensual");
  await user.type(screen.getByLabelText("Monto (S/, opcional)"), "15");
  await user.type(screen.getByLabelText("Detalle"), "Se me cobró dos veces.");
  await user.type(screen.getByLabelText("Pedido"), "Devolución del cobro duplicado.");
  await user.click(screen.getByLabelText(/Declaro que la información/));
}

describe("ComplaintsBookPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.assignComplaintNumber.mockReset().mockResolvedValue({ sheet_number: 7, submitted_at: "2026-10-09T15:00:00.000Z" });
    mocks.sendComplaint.mockReset().mockResolvedValue(undefined);
    mocks.complaintPdfBlob.mockReset().mockResolvedValue(pdf);
    mocks.downloadComplaintPdf.mockReset().mockResolvedValue(undefined);
    window.scrollTo = vi.fn();
  });

  it("sends the filled sheet as a PDF and lets the consumer download it", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(mocks.sendComplaint).toHaveBeenCalledTimes(1));
    const [record, attachment, filename] = mocks.sendComplaint.mock.calls[0]!;
    expect(record).toMatchObject({
      sheetNumber: 7,
      createdAt: "2026-10-09T15:00:00.000Z",
      data: { kind: "reclamo", item_type: "servicio", consumer_name: "Ana Pérez", consumer_phone: null, claimed_amount: 15, is_minor: false, guardian_name: null },
    });
    expect(attachment).toBe(pdf);
    expect(filename).toBe("hoja.pdf");
    expect(await screen.findByText("Hoja de reclamación N.° 001-000000007")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Descargar copia (PDF)" }));
    expect(mocks.downloadComplaintPdf).toHaveBeenCalledWith(record);
  });

  it("does not show provider data and lets the consumer choose product or service", () => {
    renderPage();
    expect(screen.queryByText("10774172578")).not.toBeInTheDocument();
    expect(screen.queryByText("Razón social")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Servicio" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Producto" })).not.toBeChecked();
    expect(screen.queryByRole("switch", { name: "Modo prueba" })).not.toBeInTheDocument();
  });

  it("offers test mode only with ?prueba and sends without a correlative number", async () => {
    const user = userEvent.setup();
    renderPage("/libro-reclamaciones?prueba");
    const toggle = screen.getByRole("switch", { name: "Modo prueba" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Hoja de reclamación N.° 001-PRUEBA")).toBeInTheDocument();
    expect(mocks.assignComplaintNumber).not.toHaveBeenCalled();
    expect(mocks.sendComplaint.mock.calls[0]![0]).toMatchObject({ sheetNumber: null });
  });

  it("reuses the assigned number when sending is retried", async () => {
    mocks.sendComplaint.mockRejectedValueOnce(new Error("No se pudo enviar tu reclamo."));
    const user = userEvent.setup();
    renderPage();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("No se pudo enviar tu reclamo.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Hoja de reclamación N.° 001-000000007")).toBeInTheDocument();
    expect(mocks.assignComplaintNumber).toHaveBeenCalledTimes(1);
    expect(mocks.sendComplaint).toHaveBeenCalledTimes(2);
  });

  it("sends the attached evidence along with the sheet and lets the consumer remove files", async () => {
    const user = userEvent.setup();
    renderPage();
    const photo = new File(["img"], "captura.png", { type: "image/png" });
    const receipt = new File(["%PDF"], "voucher.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Seleccionar archivo"), [photo, receipt]);
    expect(screen.getByText("captura.png")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar captura.png" }));
    expect(screen.queryByText("captura.png")).not.toBeInTheDocument();

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(mocks.sendComplaint).toHaveBeenCalledTimes(1));
    expect(mocks.sendComplaint.mock.calls[0]![3]).toEqual([receipt]);
  });

  it("rejects evidence above the size limit", async () => {
    const user = userEvent.setup();
    renderPage();
    const big = new File(["x"], "video.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 + 1 });
    await user.upload(screen.getByLabelText("Seleccionar archivo"), big);
    expect(screen.getByText("Los archivos superan los 5 MB permitidos en total.")).toBeInTheDocument();
    expect(screen.getByText("Sin archivos seleccionados")).toBeInTheDocument();
  });

  it("requires guardian data for minors", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillRequired(user);
    await user.click(screen.getByLabelText("Soy menor de edad"));
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Ingresa el nombre del padre, madre o apoderado.")).toBeInTheDocument();
    expect(mocks.assignComplaintNumber).not.toHaveBeenCalled();
  });
});
