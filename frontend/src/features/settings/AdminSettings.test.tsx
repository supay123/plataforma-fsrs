import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { ToastProvider } from "../../components/ui/toast";
import { DEFAULT_XP_SETTINGS } from "../xp/api";
import { AdminSettings } from "./AdminSettings";

const mocks = vi.hoisted(() => ({ listColleges: vi.fn(), getCollegeXpSettings: vi.fn() }));
vi.mock("../colleges/api", () => ({ listColleges: mocks.listColleges }));
vi.mock("../xp/api", async (original) => ({ ...(await original<typeof import("../xp/api")>()), getCollegeXpSettings: mocks.getCollegeXpSettings }));
vi.mock("../theme/ThemeSettings", () => ({ ThemeSettings: ({ college }: { college: { name: string } }) => <p>Tema de {college.name}</p> }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ToastProvider><ModalProvider><AdminSettings security={<p>Contenido de seguridad</p>} /></ModalProvider></ToastProvider></QueryClientProvider>);
}

describe("AdminSettings", () => {
  afterEach(cleanup);
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.listColleges.mockResolvedValue([{ id: "c1", code: "COL-1", name: "Colegio Uno" }, { id: "c2", code: "COL-2", name: "Colegio Dos" }]);
    mocks.getCollegeXpSettings.mockResolvedValue(DEFAULT_XP_SETTINGS);
  });

  it("muestra el selector de institución sobre las pestañas y la institución elegida llega a Colores y Puntos", async () => {
    const user = userEvent.setup();
    renderPage();
    const selector = await screen.findByRole("combobox", { name: /Institución/ });
    expect(selector.compareDocumentPosition(screen.getByRole("tablist")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Contenido de seguridad")).toBeInTheDocument();

    await user.selectOptions(selector, "c2");
    await user.click(screen.getByRole("tab", { name: "Colores" }));
    expect(screen.getByText("Tema de Colegio Dos")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Puntos" }));
    await waitFor(() => expect(mocks.getCollegeXpSettings).toHaveBeenCalledWith("c2"));
  });

  it("avisa cuando no hay instituciones en las pestañas que las necesitan", async () => {
    const user = userEvent.setup();
    mocks.listColleges.mockResolvedValue([]);
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Puntos" }));
    expect(await screen.findByText(/Todavía no hay instituciones/)).toBeInTheDocument();
  });
});
