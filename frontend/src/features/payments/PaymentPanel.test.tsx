import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN, SEMESTER_PLAN, type Plan } from "../../config/business";
import { ToastProvider } from "../../components/ui/toast";
import { AppError } from "../../lib/api/errors";
import { PaymentPanel } from "./PaymentPanel";

const createPayment = vi.fn();
const fetchStatus = vi.fn();
const onPaid = vi.fn();
const simulatePayment = vi.fn();

const inHalfAnHour = () => new Date(Date.now() + 1_800_000).toISOString();

function payment(id: string, overrides: Record<string, unknown> = {}) {
  return { payment_id: id, plan: "mensual", amount: 14.9, qr_payload: "000201010212", bank_code: null, checkout_url: "https://pay.kuti.pe/c/ABC", expires_at: inHalfAnHour(), livemode: true, ...overrides };
}

function renderPanel(plan: Plan = PLAN) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (node: ReactNode) => <QueryClientProvider client={queryClient}><ToastProvider>{node}</ToastProvider></QueryClientProvider>;
  const panel = (current: Plan) => <PaymentPanel plan={current} payerKey="payer-1" createPayment={createPayment} fetchStatus={fetchStatus} simulatePayment={simulatePayment} onPaid={onPaid} unavailableNote="Guardamos tus datos 24 horas." />;
  const view = render(wrap(panel(plan)));
  return { ...view, changePlan: (next: Plan) => view.rerender(wrap(panel(next))) };
}

describe("PaymentPanel", () => {
  afterEach(cleanup);
  beforeEach(() => {
    createPayment.mockReset().mockResolvedValue(payment("payment-1"));
    fetchStatus.mockReset().mockResolvedValue({ payment_id: "payment-1", status: "pending", expires_at: inHalfAnHour() });
    onPaid.mockReset();
    simulatePayment.mockReset().mockResolvedValue({ payment_id: "payment-1", status: "paid", expires_at: inHalfAnHour() });
  });

  it("shows the QR of the chosen plan and its payment page", async () => {
    renderPanel();
    expect(await screen.findByTitle("QR de pago")).toBeInTheDocument();
    expect(createPayment).toHaveBeenCalledWith("mensual");
    expect(screen.getByRole("link", { name: /Página de pago/ })).toHaveAttribute("href", "https://pay.kuti.pe/c/ABC");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText(/Modo prueba/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Simular pago/ })).not.toBeInTheDocument();
  });

  it("offers the bank code when the charge has one", async () => {
    const user = userEvent.setup();
    createPayment.mockResolvedValue(payment("payment-1", { plan: "semestral", amount: 77.4, bank_code: "41041172" }));
    renderPanel(SEMESTER_PLAN);
    await user.click(await screen.findByRole("tab", { name: /Código de pago/ }));
    expect(screen.getByText("41041172")).toBeInTheDocument();
    expect(screen.getByText(/Pago de servicios/)).toBeInTheDocument();
  });

  it("warns that a test-mode charge does not move real money", async () => {
    createPayment.mockResolvedValue(payment("payment-1", { livemode: false }));
    renderPanel();
    expect(await screen.findByText("Modo prueba: este cobro no mueve dinero real.")).toBeInTheDocument();
  });

  it("lets a test-mode charge be marked as paid with the chosen method", async () => {
    const user = userEvent.setup();
    createPayment.mockResolvedValue(payment("payment-1", { livemode: false, plan: "semestral", amount: 77.4, bank_code: "41041172" }));
    fetchStatus.mockResolvedValueOnce({ payment_id: "payment-1", status: "pending", expires_at: inHalfAnHour() })
      .mockResolvedValue({ payment_id: "payment-1", status: "paid", expires_at: inHalfAnHour() });
    renderPanel(SEMESTER_PLAN);
    await user.click(await screen.findByRole("tab", { name: /Código de pago/ }));
    await user.click(screen.getByRole("button", { name: /Simular pago/ }));
    expect(simulatePayment).toHaveBeenCalledWith("payment-1", "code");
    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
  });

  it("asks for a new charge when the plan changes", async () => {
    createPayment.mockResolvedValueOnce(payment("payment-1")).mockResolvedValueOnce(payment("payment-2", { plan: "semestral", amount: 77.4 }));
    const { changePlan } = renderPanel();
    await screen.findByTitle("QR de pago");
    changePlan(SEMESTER_PLAN);
    await waitFor(() => expect(createPayment).toHaveBeenLastCalledWith("semestral"));
    expect(await screen.findByText("S/ 77.40")).toBeInTheDocument();
  });

  it("calls onPaid once the payment is applied", async () => {
    fetchStatus.mockResolvedValue({ payment_id: "payment-1", status: "paid", expires_at: inHalfAnHour() });
    renderPanel();
    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
  });

  it("offers a new charge when the previous one expired", async () => {
    const user = userEvent.setup();
    fetchStatus.mockResolvedValue({ payment_id: "payment-1", status: "expired", expires_at: inHalfAnHour() });
    renderPanel();
    await user.click(await screen.findByRole("button", { name: /Generar otro cobro/ }));
    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(2));
  });

  it("falls back to WhatsApp while online payments are not configured", async () => {
    createPayment.mockRejectedValue(new AppError("payments_unavailable", "El pago en línea todavía no está disponible."));
    renderPanel();
    expect(await screen.findByText("Muy pronto podrás completar el pago aquí")).toBeInTheDocument();
    expect(screen.getByText("Guardamos tus datos 24 horas.")).toBeInTheDocument();
  });
});
