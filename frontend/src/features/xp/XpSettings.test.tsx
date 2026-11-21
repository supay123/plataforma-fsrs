import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { ToastProvider } from "../../components/ui/toast";
import { DEFAULT_XP_SETTINGS } from "./api";
import { XpSettings } from "./XpSettings";

const mocks = vi.hoisted(() => ({ getCollegeXpSettings: vi.fn(), saveCollegeXpSettings: vi.fn() }));
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), getCollegeXpSettings: mocks.getCollegeXpSettings, saveCollegeXpSettings: mocks.saveCollegeXpSettings }));

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ToastProvider><ModalProvider><XpSettings college={{ id: "c1", name: "Colegio Uno" }} /></ModalProvider></ToastProvider></QueryClientProvider>);
}

describe("XpSettings", () => {
  afterEach(cleanup);
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getCollegeXpSettings.mockResolvedValue(DEFAULT_XP_SETTINGS);
    mocks.saveCollegeXpSettings.mockResolvedValue(undefined);
  });

  it("muestra los valores de la institución y el costo de los primeros niveles", async () => {
    renderTab();
    expect(await screen.findByLabelText(/XP base/)).toHaveValue(100);
    expect(screen.getByLabelText(/Incremento del XP por nivel/)).toHaveValue(0.2);
    expect(screen.getByLabelText(/Por pregunta acertada/)).toHaveValue(75);
    expect(screen.getByText("145 XP")).toBeInTheDocument();
  });

  it("guarda solo tras confirmar y avisa que afecta a toda la institución", async () => {
    const user = userEvent.setup();
    renderTab();
    const perCorrect = await screen.findByLabelText(/Por pregunta acertada/);
    await user.clear(perCorrect);
    await user.type(perCorrect, "80");
    await user.click(screen.getByRole("button", { name: "Guardar reglas" }));
    expect(await screen.findByText(/toda la institución Colegio Uno/)).toBeInTheDocument();
    expect(mocks.saveCollegeXpSettings).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.saveCollegeXpSettings).toHaveBeenCalledWith("c1", { ...DEFAULT_XP_SETTINGS, xp_per_correct: 80 }));
  });

  it("señala un valor fuera de rango y bloquea el guardado", async () => {
    const user = userEvent.setup();
    renderTab();
    const growth = await screen.findByLabelText(/Incremento del XP por nivel/);
    await user.clear(growth);
    await user.type(growth, "9");
    expect(screen.getByText("Debe estar entre 0 y 5.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar reglas" })).toBeDisabled();
  });
});
