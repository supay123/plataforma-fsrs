import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { ToastProvider } from "../../components/ui/toast";
import { DEFAULT_PALETTES } from "../../lib/theme/palette";
import { ThemeSettings } from "./ThemeSettings";

const mocks = vi.hoisted(() => ({ getCollegeThemes: vi.fn(), saveCollegeThemes: vi.fn(), resetCollegeThemes: vi.fn(), setInstId: vi.fn(), reloadTheme: vi.fn() }));
vi.mock("../../lib/theme/theme-context", () => ({ useTheme: () => ({ setInstId: mocks.setInstId, reloadTheme: mocks.reloadTheme }) }));
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), getCollegeThemes: mocks.getCollegeThemes, saveCollegeThemes: mocks.saveCollegeThemes, resetCollegeThemes: mocks.resetCollegeThemes }));

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ToastProvider><ModalProvider><ThemeSettings college={{ id: "c1", code: "COL-1", name: "Colegio Uno" }} /></ModalProvider></ToastProvider></QueryClientProvider>);
}

describe("ThemeSettings", () => {
  afterEach(cleanup);
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getCollegeThemes.mockResolvedValue({ light: null, dark: null });
    mocks.saveCollegeThemes.mockResolvedValue(undefined);
    mocks.resetCollegeThemes.mockResolvedValue(undefined);
  });

  it("muestra los colores por defecto cuando la institución no tiene tema", async () => {
    renderTab();
    await waitFor(() => expect(mocks.getCollegeThemes).toHaveBeenCalledWith("c1"));
    const inputs = await screen.findAllByLabelText("Primario: código del color");
    expect(inputs.map((input) => (input as HTMLInputElement).value)).toEqual([DEFAULT_PALETTES.light.primary, DEFAULT_PALETTES.dark.primary]);
  });

  it("pide confirmación antes de guardar y avisa que afecta a toda la institución", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole("button", { name: "Guardar colores" }));
    expect(await screen.findByText(/toda la institución Colegio Uno/)).toBeInTheDocument();
    expect(mocks.saveCollegeThemes).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.saveCollegeThemes).toHaveBeenCalledWith("c1", { light: DEFAULT_PALETTES.light, dark: DEFAULT_PALETTES.dark }));
    await waitFor(() => expect(mocks.reloadTheme).toHaveBeenCalled());
    expect(mocks.setInstId).toHaveBeenCalledWith("COL-1");
  });

  it("restablece solo tras confirmar", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole("button", { name: "Restablecer colores" }));
    expect(mocks.resetCollegeThemes).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Restablecer" }));
    await waitFor(() => expect(mocks.resetCollegeThemes).toHaveBeenCalledWith("c1"));
  });

  it("un color mal escrito se señala y no se aplica", async () => {
    const user = userEvent.setup();
    renderTab();
    const [light] = await screen.findAllByLabelText("Primario: código del color");
    await user.clear(light!);
    await user.type(light!, "#12");
    expect(screen.getAllByText("Usa el formato #rrggbb.").length).toBeGreaterThan(0);
  });
});
