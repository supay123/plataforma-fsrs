import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { ToastProvider } from "../../components/ui/toast";
import { RankingSettings } from "./RankingSettings";

const mocks = vi.hoisted(() => ({ getRankingSettings: vi.fn(), saveRankingSettings: vi.fn() }));
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), ...mocks }));

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ToastProvider><ModalProvider><RankingSettings college={{ id: "c1", name: "Colegio Uno" }} /></ModalProvider></ToastProvider></QueryClientProvider>);
}

describe("RankingSettings", () => {
  afterEach(cleanup);
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getRankingSettings.mockResolvedValue({ college_id: "c1", is_default: true, enabled: false, categories: ["NIVEL", "MEDALLAS", "NOTA"], available_categories: [], visible: false });
    mocks.saveRankingSettings.mockResolvedValue({});
  });

  it("viene desactivado por defecto y no muestra las categorías", async () => {
    renderTab();
    expect(await screen.findByRole("switch", { name: /Activar ranking/ })).not.toBeChecked();
    expect(screen.queryByText("Categorías que se muestran")).not.toBeInTheDocument();
  });

  it("guarda las categorías elegidas solo tras confirmar el aviso", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole("switch", { name: /Activar ranking/ }));
    await user.click(screen.getByRole("checkbox", { name: /Nivel/ }));
    await user.click(screen.getByRole("checkbox", { name: /Nota/ }));
    await user.click(screen.getByRole("button", { name: "Guardar ranking" }));
    expect(mocks.saveRankingSettings).not.toHaveBeenCalled();
    expect(screen.getByText(/toda la institución Colegio Uno/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.saveRankingSettings).toHaveBeenCalledWith("c1", { enabled: true, categories: ["MEDALLAS"] }));
  });

  it("no deja guardar activado sin ninguna categoría", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole("switch", { name: /Activar ranking/ }));
    for (const name of [/Nivel/, /Medallas/, /Nota/]) await user.click(screen.getByRole("checkbox", { name }));
    expect(screen.getByRole("button", { name: "Guardar ranking" })).toBeDisabled();
  });
});
