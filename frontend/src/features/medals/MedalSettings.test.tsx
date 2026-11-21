import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { ToastProvider } from "../../components/ui/toast";
import { DEFAULT_MEDAL_RULES } from "./api";
import { MedalSettings } from "./MedalSettings";

const mocks = vi.hoisted(() => ({ getMedalSettings: vi.fn(), saveMedalSettings: vi.fn() }));
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), getMedalSettings: mocks.getMedalSettings, saveMedalSettings: mocks.saveMedalSettings }));

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ToastProvider><ModalProvider><MedalSettings college={{ id: "c1", name: "Colegio Uno" }} /></ModalProvider></ToastProvider></QueryClientProvider>);
}

describe("MedalSettings", () => {
  afterEach(cleanup);
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getMedalSettings.mockResolvedValue({ college_id: "c1", is_default: true, medals: [], grade_ranges: [], ...DEFAULT_MEDAL_RULES });
    mocks.saveMedalSettings.mockResolvedValue({});
  });

  it("muestra los rangos por defecto de la institución", async () => {
    renderTab();
    expect(await screen.findByLabelText("Postulante I: hasta (estrellas)")).toHaveValue(2);
    expect(screen.getByLabelText("Pre-Ingresante III: hasta (estrellas)")).toHaveValue(101);
    expect(screen.getByText("Desde 102 estrellas en adelante.")).toBeInTheDocument();
    expect(screen.getByLabelText("-3 estrellas: hasta (nota)")).toHaveValue(2);
    expect(screen.getByText("Hasta la nota 20.")).toBeInTheDocument();
  });

  it("guarda solo tras confirmar el aviso que afecta a toda la institución", async () => {
    const user = userEvent.setup();
    renderTab();
    const first = await screen.findByLabelText("Postulante I: hasta (estrellas)");
    await user.clear(first);
    await user.type(first, "3");
    await user.click(screen.getByRole("button", { name: "Guardar medallas" }));
    expect(await screen.findByText(/todos los estudiantes de la institución Colegio Uno/)).toBeInTheDocument();
    expect(mocks.saveMedalSettings).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.saveMedalSettings).toHaveBeenCalledWith("c1", { ...DEFAULT_MEDAL_RULES, star_range_ends: [3, ...DEFAULT_MEDAL_RULES.star_range_ends.slice(1)] }));
  });

  it("bloquea el guardado con rangos que no van en orden creciente o con decimales", async () => {
    const user = userEvent.setup();
    renderTab();
    const second = await screen.findByLabelText("Postulante II: hasta (estrellas)");
    await user.clear(second);
    await user.type(second, "2");
    expect(screen.getByText("Debe ser mayor que el anterior.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar medallas" })).toBeDisabled();
    await user.clear(second);
    await user.type(second, "5.5");
    expect(screen.getByText("Usa un número entero.")).toBeInTheDocument();
  });

  it("limita el fin de las notas a 19 para que +3 termine en 20", async () => {
    const user = userEvent.setup();
    renderTab();
    const last = await screen.findByLabelText("+2 estrellas: hasta (nota)");
    await user.clear(last);
    await user.type(last, "20");
    expect(screen.getByText("No puede pasar de 19.")).toBeInTheDocument();
  });

  it("al desactivar las medallas oculta los editores y solo guarda el interruptor", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole("switch", { name: /Activar medallas/ }));
    expect(screen.queryByLabelText("Postulante I: hasta (estrellas)")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar medallas" }));
    await user.click(await screen.findByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.saveMedalSettings).toHaveBeenCalledWith("c1", { enabled: false }));
  });
});
