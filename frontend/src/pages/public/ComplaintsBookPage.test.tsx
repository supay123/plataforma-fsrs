import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/api/errors";
import { ComplaintsBookPage } from "./ComplaintsBookPage";

const mocks = vi.hoisted(() => ({ sendComplaint: vi.fn() }));

vi.mock("../../features/complaints/api", () => ({
  EVIDENCE_MAX_BYTES: 5 * 1024 * 1024,
  sendComplaint: mocks.sendComplaint,
  pdfFromBase64: () => new Blob(["%PDF"], { type: "application/pdf" }),
}));

const sent = { sheet_number: 7, submitted_at: "2026-10-09T15:00:00.000Z", pdf: "JVBERg==" };

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
    mocks.sendComplaint.mockReset().mockResolvedValue(sent);
    window.scrollTo = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:hoja");
    URL.revokeObjectURL = vi.fn();
  });

  it("sends the filled sheet and lets the consumer download the PDF made by the server", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(mocks.sendComplaint).toHaveBeenCalledTimes(1));
    const [data, options] = mocks.sendComplaint.mock.calls[0]!;
    expect(data).toMatchObject({ kind: "reclamo", item_type: "servicio", consumer_name: "Ana Pérez", consumer_phone: null, claimed_amount: 15, is_minor: false, guardian_name: null });
    expect(options).toEqual({ test: false, evidence: [], retrySheetNumber: null });
    expect(await screen.findByText("Hoja de reclamación N.° 001-000000007")).toBeInTheDocument();

    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    await user.click(screen.getByRole("button", { name: "Descargar copia (PDF)" }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
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
    mocks.sendComplaint.mockResolvedValue({ ...sent, sheet_number: null });
    const user = userEvent.setup();
    renderPage("/libro-reclamaciones?prueba");
    const toggle = screen.getByRole("switch", { name: "Modo prueba" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Hoja de reclamación N.° 001-PRUEBA")).toBeInTheDocument();
    expect(mocks.sendComplaint.mock.calls[0]![1]).toMatchObject({ test: true, retrySheetNumber: null });
  });

  it("offers WhatsApp on failure and retries with the number already assigned", async () => {
    mocks.sendComplaint.mockRejectedValueOnce(new AppError("complaint_not_sent", "No pudimos enviar tu hoja de reclamación.", { sheet_number: 7 }));
    const user = userEvent.setup();
    renderPage();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(/No pudimos enviar tu hoja de reclamación\. Si el problema continúa, escríbenos por WhatsApp/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Escribir al/ })).toHaveAttribute("href", "https://wa.me/51942722127");

    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Hoja de reclamación N.° 001-000000007")).toBeInTheDocument();
    expect(mocks.sendComplaint.mock.calls[1]![1]).toMatchObject({ retrySheetNumber: 7 });
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
    expect(mocks.sendComplaint.mock.calls[0]![1]).toMatchObject({ evidence: [receipt] });
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
    expect(mocks.sendComplaint).not.toHaveBeenCalled();
  });
});
