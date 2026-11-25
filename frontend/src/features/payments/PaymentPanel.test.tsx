import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN, SEMESTER_PLAN, type Plan } from "../../config/business";
import { ModalProvider } from "../../components/ui/modal";
import { chooseSelectValue } from "../../components/ui/select-test-helpers";
import { ToastProvider } from "../../components/ui/toast";
import { AppError } from "../../lib/api/errors";
import { PaymentPanel } from "./PaymentPanel";

const mocks = vi.hoisted(() => ({ getPaymentConfig: vi.fn(), createYapeToken: vi.fn(), getDeviceSessionId: vi.fn() }));
vi.mock("./api", () => ({ getPaymentConfig: mocks.getPaymentConfig }));
vi.mock("./yape", () => ({ createYapeToken: mocks.createYapeToken, getDeviceSessionId: mocks.getDeviceSessionId, loadDeviceSessionScript: vi.fn() }));

const PAYER = { first_name: "María", last_name: "Quispe", document_type: "DNI", document: "12345678" };
const createPayment = vi.fn();
const fetchStatus = vi.fn();
const onPaid = vi.fn();

function payment(status: string, overrides: Record<string, unknown> = {}) {
  return { payment_id: "payment-1", plan: "mensual", amount: 14.9, status, status_detail: null, livemode: false, ...overrides };
}

function renderPanel(plan: Plan = PLAN) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><ToastProvider><ModalProvider>
    <PaymentPanel plan={plan} createPayment={createPayment} fetchStatus={fetchStatus} onPaid={onPaid} unavailableNote="Guardamos tus datos 24 horas." />
  </ModalProvider></ToastProvider></QueryClientProvider>);
}

async function pay(user: ReturnType<typeof userEvent.setup>, phone = "111111111", otp = "123456") {
  if (phone) {
    await user.type(await screen.findByLabelText("Celular de Yape"), phone);
    await user.type(screen.getByLabelText("Nombre del titular del Yape"), "María");
    await user.type(screen.getByLabelText("Apellido del titular del Yape"), "Quispe");
    await user.type(screen.getByLabelText("Número de documento"), "12345678");
  }
  await user.type(screen.getByLabelText(/^Código de aprobación/), otp);
  await user.click(screen.getByRole("button", { name: /con Yape/ }));
}

describe("PaymentPanel", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.getPaymentConfig.mockReset().mockResolvedValue({ public_key: "TEST-public-key" });
    mocks.createYapeToken.mockReset().mockResolvedValue("yape-token-1");
    mocks.getDeviceSessionId.mockReset().mockResolvedValue("device-1");
    createPayment.mockReset().mockResolvedValue(payment("paid"));
    fetchStatus.mockReset().mockResolvedValue(payment("paid"));
    onPaid.mockReset();
  });

  it("charges the chosen plan with the Yape token and calls onPaid once", async () => {
    const user = userEvent.setup();
    renderPanel(SEMESTER_PLAN);
    expect(await screen.findByRole("button", { name: "Pagar S/ 77.40 con Yape" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Paga con Yape" })).toHaveAttribute("src", "/image/yape-logo.svg");
    await pay(user, "+51 111 111 111");
    expect(mocks.createYapeToken).toHaveBeenCalledWith("TEST-public-key", "111111111", "123456");
    expect(createPayment).toHaveBeenCalledWith("semestral", { token: "yape-token-1", phone: "111111111", payer: PAYER, device_session_id: "device-1" });
    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
  });

  it("guides the student through the form in a three-step tutorial modal", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Ver tutorial paso a paso" }));
    const dialog = screen.getByRole("dialog", { name: "¿Cómo completo mis datos?" });
    expect(dialog).toHaveTextContent("Paso 1 de 3");
    expect(dialog).toHaveTextContent("Tu celular de Yape");
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(dialog).toHaveTextContent("Paso 2 de 3");
    expect(dialog).toHaveTextContent("Aprobar compras");
    expect(screen.getByRole("img", { name: /código de aprobación/ })).toHaveAttribute("src", "/image/codigo-yape.webp");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(dialog).toHaveTextContent("Paso 3 de 3");
    expect(dialog).toHaveTextContent("nombre");
    expect(dialog).toHaveTextContent("DNI");
    expect(screen.queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Entendido" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(dialog).toHaveTextContent("Paso 2 de 3");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Finalizar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("validates the phone and the 6-digit approval code before charging", async () => {
    const user = userEvent.setup();
    renderPanel();
    await pay(user, "1234", "12");
    expect(await screen.findByText("Ingresa el celular de tu Yape, 9 dígitos.")).toBeInTheDocument();
    expect(screen.getByText("El código de aprobación tiene 6 dígitos.")).toBeInTheDocument();
    expect(mocks.createYapeToken).not.toHaveBeenCalled();
  });

  it("explains a rejection and lets the student try again with a new code", async () => {
    const user = userEvent.setup();
    createPayment.mockResolvedValueOnce(payment("failed", { status_detail: "invalid_card_token" }));
    renderPanel();
    await pay(user);
    expect(await screen.findByText(/El código de aprobación ya se usó o venció/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Código de aprobación/)).toHaveValue("");
    await pay(user, "", "654321");
    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(2));
  });

  it("asks for the name and DNI of the Yape holder before charging", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(await screen.findByLabelText("Celular de Yape"), "111111111");
    await user.type(screen.getByLabelText(/^Código de aprobación/), "123456");
    await user.type(screen.getByLabelText("Número de documento"), "1234");
    await user.click(screen.getByRole("button", { name: /con Yape/ }));
    expect(await screen.findByText("Ingresa el nombre del titular del Yape.")).toBeInTheDocument();
    expect(screen.getByText("Ingresa el apellido del titular del Yape.")).toBeInTheDocument();
    expect(screen.getByText("El DNI tiene 8 dígitos.")).toBeInTheDocument();
    expect(mocks.createYapeToken).not.toHaveBeenCalled();
  });

  it("charges with a carné de extranjería when the holder chooses it", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(await screen.findByLabelText("Celular de Yape"), "111111111");
    await user.type(screen.getByLabelText(/^Código de aprobación/), "123456");
    await user.type(screen.getByLabelText("Nombre del titular del Yape"), "Ana");
    await user.type(screen.getByLabelText("Apellido del titular del Yape"), "Quispe");
    const documentType = screen.getByRole("combobox");
    expect(documentType).toHaveTextContent("DNI");
    await chooseSelectValue(user, documentType, "CE");
    await user.type(screen.getByLabelText("Número de documento"), "ce-1234567");
    await user.click(screen.getByRole("button", { name: /con Yape/ }));
    await waitFor(() => expect(createPayment).toHaveBeenCalledWith("mensual", expect.objectContaining({ payer: { first_name: "Ana", last_name: "Quispe", document_type: "CE", document: "CE1234567" } })));
  });

  it("offers WhatsApp as a second method with the plan in the message", async () => {
    const user = userEvent.setup();
    renderPanel(SEMESTER_PLAN);
    await user.click(await screen.findByRole("tab", { name: "WhatsApp" }));
    expect(screen.queryByLabelText("Celular de Yape")).not.toBeInTheDocument();
    expect(screen.getByText(/\+51 942 722 127/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Escribir por WhatsApp" });
    expect(link).toHaveAttribute("href", "https://wa.me/51942722127?text=Hola%2C%20quiero%20una%20suscripci%C3%B3n%20por%206%20meses");
    await user.click(screen.getByRole("tab", { name: "Yape" }));
    expect(screen.getByLabelText("Celular de Yape")).toBeInTheDocument();
  });

  it("says 1 mes in the WhatsApp message of the monthly plan", async () => {
    const user = userEvent.setup();
    renderPanel(PLAN);
    await user.click(await screen.findByRole("tab", { name: "WhatsApp" }));
    expect(screen.getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute("href", expect.stringContaining("por%201%20mes"));
  });

  it("waits while the payment is being applied", async () => {
    const user = userEvent.setup();
    createPayment.mockResolvedValue(payment("processing"));
    fetchStatus.mockResolvedValueOnce(payment("processing")).mockResolvedValue(payment("paid"));
    renderPanel();
    await pay(user);
    expect(await screen.findByText("Pago recibido. Lo estamos aplicando…")).toBeInTheDocument();
    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1), { timeout: 6000 });
  });

  it("shows the error and keeps the form when Yape rejects the code", async () => {
    const user = userEvent.setup();
    mocks.createYapeToken.mockRejectedValue(new AppError("yape_token_failed", "Yape no aceptó el celular o el código de aprobación."));
    renderPanel();
    await pay(user);
    expect(await screen.findByText("Yape no aceptó el celular o el código de aprobación.")).toBeInTheDocument();
    expect(createPayment).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Celular de Yape")).toHaveValue("111111111");
  });

  it("charges without the device id when the security script did not load", async () => {
    const user = userEvent.setup();
    mocks.getDeviceSessionId.mockResolvedValue(null);
    renderPanel();
    await pay(user);
    expect(createPayment).toHaveBeenCalledWith("mensual", { token: "yape-token-1", phone: "111111111", payer: PAYER });
  });

  it("always offers the WhatsApp contact below the pay button", async () => {
    renderPanel();
    const link = await screen.findByRole("link", { name: /Problemas para pagar/ });
    expect(link).toHaveAttribute("href", "https://walink.co/r8grwq");
    expect(link.className).not.toContain("animate-pop");
  });

  it("lets the student dismiss the rejection message", async () => {
    const user = userEvent.setup();
    createPayment.mockResolvedValue(payment("failed", { status_detail: "rejected_by_issuer" }));
    renderPanel();
    await pay(user);
    expect(await screen.findByText(/Yape rechazó el pago/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByText(/Yape rechazó el pago/)).not.toBeInTheDocument();
  });

  it("makes the WhatsApp button pop after each failure and opens a modal on the third", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    createPayment.mockImplementation(() => Promise.resolve(payment("failed", { payment_id: `payment-${++attempt}`, status_detail: "rejected_by_issuer" })));
    renderPanel();
    await pay(user);
    expect(await screen.findByText(/Yape rechazó el pago/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Problemas para pagar/ }).className).toContain("animate-pop");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await pay(user, "", "654321");
    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await pay(user, "", "111222");
    const dialog = await screen.findByRole("dialog", { name: "¿Tienes problemas para pagar?" });
    expect(within(dialog).getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute("href", "https://walink.co/r8grwq");
  });

  it.each([
    ["high_risk", /Mercado Pago no pudo aprobar este pago por seguridad/],
    ["processing_error", /Mercado Pago tuvo un error al procesar el pago/],
  ])("opens the WhatsApp modal and removes the form when the rejection is %s", async (statusDetail, message) => {
    const user = userEvent.setup();
    createPayment.mockResolvedValueOnce(payment("failed", { status_detail: statusDetail }));
    renderPanel();
    await pay(user);
    const dialog = await screen.findByRole("dialog", { name: "Necesitamos ayudarte con tu pago" });
    expect(within(dialog).getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute("href", "https://walink.co/r8grwq");
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Código de aprobación/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /con Yape/ })).not.toBeInTheDocument();
  });

  it("falls back to WhatsApp while online payments are not configured", async () => {
    mocks.getPaymentConfig.mockRejectedValue(new AppError("payments_unavailable", "El pago en línea todavía no está disponible."));
    renderPanel();
    expect(await screen.findByText("Muy pronto podrás completar el pago aquí")).toBeInTheDocument();
    expect(screen.getByText("Guardamos tus datos 24 horas.")).toBeInTheDocument();
  });
});
