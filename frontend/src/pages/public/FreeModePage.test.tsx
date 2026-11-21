import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { ToastProvider } from "../../components/ui/toast";
import { FreeModePage } from "./FreeModePage";

const mocks = vi.hoisted(() => ({ getFreeModeCatalog: vi.fn(), getFreeModeQuestions: vi.fn(), registerFreeModeLead: vi.fn() }));
vi.mock("../../features/free-mode/api", () => mocks);
vi.mock("../../features/sessions/PracticeMascot", () => ({ PracticeMascot: () => null }));
vi.mock("../../features/payments/PlanCards", () => ({ PlanCards: () => <div>Tarjetas de planes</div> }));

const questions = Array.from({ length: 2 }, (_, index) => ({
  id: `q${index + 1}`, statement: `Pregunta ${index + 1}`, option_a: "a", option_b: "b", option_c: "c", option_d: "d", correct_option: "A" as const, explanation: null,
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><ToastProvider><ModalProvider><MemoryRouter initialEntries={["/gratis?tema=t1"]}><Routes><Route path="/gratis" element={<FreeModePage />} /><Route path="/" element={<div>Inicio</div>} /></Routes></MemoryRouter></ModalProvider></ToastProvider></QueryClientProvider>);
}

describe("FreeModePage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getFreeModeCatalog.mockResolvedValue([{ id: "g1", name: "Grupo de prueba", courses: [{ id: "c1", name: "Matemática", topics: [{ id: "t1", name: "Fracciones" }] }] }]);
    mocks.getFreeModeQuestions.mockResolvedValue({ topic: { id: "t1", name: "Fracciones" }, questions });
    mocks.registerFreeModeLead.mockResolvedValue({ ok: true });
  });

  it("loads the questions of the topic from the url and starts the test", async () => {
    renderPage();
    await waitFor(() => expect(mocks.getFreeModeQuestions).toHaveBeenCalledWith("t1"));
    expect(await screen.findByText("Pregunta 1 de 2")).toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("goes back to the home when there is no topic", async () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><ModalProvider><MemoryRouter initialEntries={["/gratis"]}><Routes><Route path="/gratis" element={<FreeModePage />} /><Route path="/" element={<div>Inicio</div>} /></Routes></MemoryRouter></ModalProvider></QueryClientProvider>);
    expect(await screen.findByText("Inicio")).toBeInTheDocument();
  });

  it("runs the test, asks for the lead data and then shows the plans", async () => {
    const user = userEvent.setup();
    renderPage();

    for (const nextLabel of ["Siguiente", "Finalizar práctica"]) {
      await user.click(await screen.findByRole("button", { name: /^A/ }));
      await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
      await user.click(screen.getByRole("button", { name: nextLabel }));
    }
    expect(await screen.findByText("Tarjetas de planes")).toBeInTheDocument();
    expect(screen.getByText("Acertaste 2 de 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Debes autorizar el contacto para continuar.")).toBeInTheDocument();
    expect(mocks.registerFreeModeLead).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/^Nombres/), "Ana");
    await user.type(screen.getByLabelText(/^Apellidos/), "Pérez");
    await user.type(screen.getByLabelText(/^Correo electrónico/), "ana@example.com");
    await user.type(screen.getByLabelText(/^WhatsApp/), "987654321");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(mocks.registerFreeModeLead).toHaveBeenCalled());
    expect(mocks.registerFreeModeLead.mock.calls[0]?.[0]).toMatchObject({ given_names: "Ana", phone: "987654321", accepted_data_policy: true, website: "" });
    expect(await screen.findByText("¡Gracias, Ana!")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the server error in a toast and lets the person retry when leads are unavailable", async () => {
    const user = userEvent.setup();
    mocks.registerFreeModeLead.mockRejectedValueOnce(new Error("No pudimos registrar tus datos en este momento. Inténtalo de nuevo en unos minutos."));
    renderPage();
    for (const nextLabel of ["Siguiente", "Finalizar práctica"]) {
      await user.click(await screen.findByRole("button", { name: /^A/ }));
      await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
      await user.click(screen.getByRole("button", { name: nextLabel }));
    }
    await user.type(screen.getByLabelText(/^Nombres/), "Ana");
    await user.type(screen.getByLabelText(/^Apellidos/), "Pérez");
    await user.type(screen.getByLabelText(/^Correo electrónico/), "ana@example.com");
    await user.type(screen.getByLabelText(/^WhatsApp/), "987654321");
    await user.click(screen.getByRole("checkbox", { name: /Acepto recibir ofertas y promociones/ }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText(/No pudimos registrar tus datos en este momento/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
    expect(screen.queryByText("¡Gracias, Ana!")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("¡Gracias, Ana!")).toBeInTheDocument();
    expect(mocks.registerFreeModeLead).toHaveBeenCalledTimes(2);
  });
});
