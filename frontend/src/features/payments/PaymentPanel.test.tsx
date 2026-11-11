import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN, SEMESTER_PLAN, type Plan } from "../../config/business";
import { ModalProvider } from "../../components/ui/modal";
import { ToastProvider } from "../../components/ui/toast";
import { AppError } from "../../lib/api/errors";
import { PaymentPanel } from "./PaymentPanel";

const mocks = vi.hoisted(() => ({ getPaymentConfig: vi.fn(), createYapeToken: vi.fn() }));
vi.mock("./api", () => ({ getPaymentConfig: mocks.getPaymentConfig }));
vi.mock("./yape", () => ({ createYapeToken: mocks.createYapeToken }));

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
  if (phone) await user.type(await screen.findByLabelText("Celular de Yape"), phone);
  await user.type(screen.getByLabelText(/^Código de aprobación/), otp);
  await user.click(screen.getByRole("button", { name: /con Yape/ }));
}

describe("PaymentPanel", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.getPaymentConfig.mockReset().mockResolvedValue({ public_key: "TEST-public-key" });
    mocks.createYapeToken.mockReset().mockResolvedValue("yape-token-1");
    createPayment.mockReset().mockResolvedValue(payment("paid"));
    fetchStatus.mockReset().mockResolvedValue(payment("paid"));
    onPaid.mockReset();
  });

  it("charges the chosen plan with the Yape token and calls onPaid once", async () => {
    const user = userEvent.setup();
    renderPanel(SEMESTER_PLAN);
    expect(await screen.findByText("S/ 77.40")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Paga con Yape" })).toHaveAttribute("src", "/image/yape-logo.svg");
    await pay(user, "+51 111 111 111");
    expect(mocks.createYapeToken).toHaveBeenCalledWith("TEST-public-key", "111111111", "123456");
    expect(createPayment).toHaveBeenCalledWith("semestral", { token: "yape-token-1", phone: "111111111" });
    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
  });

  it("explains where to find the approval code in a modal", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "¿Dónde está el código de aprobación?" }));
    const dialog = screen.getByRole("dialog", { name: "¿Dónde encuentro mi código?" });
    expect(dialog).toHaveTextContent("Aprobar compras");
    expect(screen.getByRole("img", { name: /código de aprobación/ })).toHaveAttribute("src", "/image/codigo-yape.webp");
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Entendido" }));
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

  it("falls back to WhatsApp while online payments are not configured", async () => {
    mocks.getPaymentConfig.mockRejectedValue(new AppError("payments_unavailable", "El pago en línea todavía no está disponible."));
    renderPanel();
    expect(await screen.findByText("Muy pronto podrás completar el pago aquí")).toBeInTheDocument();
    expect(screen.getByText("Guardamos tus datos 24 horas.")).toBeInTheDocument();
  });
});
