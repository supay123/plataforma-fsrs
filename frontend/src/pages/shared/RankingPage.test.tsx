import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { AppError } from "../../lib/api/errors";
import type { RankingItem, RankingPage as RankingPageData, RankingType } from "../../features/ranking/api";
import { RankingPage } from "./RankingPage";
import { chooseSelectValue } from "../../components/ui/select-test-helpers";

const mocks = vi.hoisted(() => ({ getRankingSettings: vi.fn(), refreshRankingCache: vi.fn(), getRankingPage: vi.fn() }));
vi.mock("../../features/ranking/api", async (original) => ({ ...(await original<typeof import("../../features/ranking/api")>()), ...mocks }));

const settings = (categories: RankingType[] = ["NIVEL", "MEDALLAS", "NOTA"]) => ({ college_id: "c1", is_default: false, enabled: true, categories, available_categories: categories, visible: categories.length > 0 });
const item = (position: number, extra: Partial<RankingItem> = {}): RankingItem => ({ position, display_name: `Alumno ${position} P. R.`, is_me: false, stars: 100 - position, medal: { code: "postulante_1", name: "Postulante 1" }, ...extra });
const page = (items: RankingItem[], extra: Partial<RankingPageData> = {}): RankingPageData => ({
  type: "MEDALLAS", page: 1, page_size: 30, total_pages: 1, total_participants: items.length, my_position: 2, items, generated_at: "", expires_at: "", ...extra,
});
const notFound = () => new AppError("ranking_cache_not_found", "La caché venció.");

function renderPage(role: "student" | "teacher" = "student") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ToastProvider><RankingPage role={role} /></ToastProvider></QueryClientProvider>);
}

describe("RankingPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getRankingSettings.mockResolvedValue(settings());
    mocks.refreshRankingCache.mockResolvedValue({ type: "MEDALLAS", total_participants: 2 });
    mocks.getRankingPage.mockResolvedValue(page([item(1), item(2, { is_me: true })]));
  });

  it("refresca la caché antes de consultar, empieza en MEDALLAS y muestra la posición", async () => {
    renderPage();
    expect(await screen.findByText("Alumno 1 P. R.")).toBeInTheDocument();
    expect(mocks.refreshRankingCache).toHaveBeenCalledWith("MEDALLAS");
    expect(mocks.refreshRankingCache.mock.invocationCallOrder[0]).toBeLessThan(mocks.getRankingPage.mock.invocationCallOrder[0]!);
    expect(mocks.getRankingPage).toHaveBeenCalledWith("MEDALLAS", 1);
    expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("Medallas");
    expect(screen.getByText("de 2 participantes")).toBeInTheDocument();
    expect(screen.getByText("(Tú)")).toBeInTheDocument();
    expect(screen.getAllByText("Postulante I")).toHaveLength(2);
  });

  it("la primera vez en cada categoría refresca y luego consulta; al volver solo consulta", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alumno 1 P. R.");
    mocks.getRankingPage.mockResolvedValue(page([item(1, { level: 3, xp: 40, medal: undefined })], { type: "NIVEL", my_position: 1 }));
    await chooseSelectValue(user, screen.getByRole("combobox", { name: "Categoría" }), "NIVEL");
    expect(await screen.findByText("Nivel 3")).toBeInTheDocument();
    expect(mocks.refreshRankingCache).toHaveBeenLastCalledWith("NIVEL");
    await chooseSelectValue(user, screen.getByRole("combobox", { name: "Categoría" }), "MEDALLAS");
    await waitFor(() => expect(mocks.getRankingPage).toHaveBeenLastCalledWith("MEDALLAS", 1));
    expect(mocks.refreshRankingCache).toHaveBeenCalledTimes(2);
  });

  it("Ver más pide la siguiente página, conserva lo mostrado y muestra el spinner mientras carga", async () => {
    const user = userEvent.setup();
    mocks.getRankingPage.mockResolvedValueOnce(page([item(1), item(2)], { total_pages: 2, total_participants: 3 }));
    let finish: (value: RankingPageData) => void = () => undefined;
    mocks.getRankingPage.mockReturnValueOnce(new Promise<RankingPageData>((resolve) => { finish = resolve; }));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Ver más" }));
    expect(screen.getByRole("status", { name: "" })).toBeInTheDocument();
    expect(screen.getByText("Alumno 1 P. R.")).toBeInTheDocument();
    expect(mocks.getRankingPage).toHaveBeenLastCalledWith("MEDALLAS", 2);
    finish(page([item(3)], { page: 2, total_pages: 2, total_participants: 3 }));
    expect(await screen.findByText("Alumno 3 P. R.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
  });

  it("si la consulta responde not_found refresca y reintenta una vez", async () => {
    mocks.getRankingPage.mockRejectedValueOnce(notFound());
    renderPage();
    expect(await screen.findByText("Alumno 1 P. R.")).toBeInTheDocument();
    expect(mocks.refreshRankingCache).toHaveBeenCalledTimes(2);
    expect(mocks.getRankingPage).toHaveBeenCalledTimes(2);
  });

  it("si vuelve a fallar muestra un toast, un mensaje y Volver a intentar", async () => {
    const user = userEvent.setup();
    mocks.getRankingPage.mockRejectedValue(notFound());
    renderPage();
    expect(await screen.findByText(/No se pudo cargar el ranking/)).toBeInTheDocument();
    expect(screen.getAllByText(/La caché venció/).length).toBeGreaterThanOrEqual(2);
    mocks.getRankingPage.mockResolvedValue(page([item(1)]));
    await user.click(screen.getByRole("button", { name: "Volver a intentar" }));
    expect(await screen.findByText("Alumno 1 P. R.")).toBeInTheDocument();
  });

  it("Actualizar ranking vuelve a crear la caché y recarga desde el inicio", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alumno 1 P. R.");
    await user.click(screen.getByRole("button", { name: /Actualizar ranking/ }));
    await waitFor(() => expect(mocks.refreshRankingCache).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.getRankingPage).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Alumno 1 P. R.")).toBeInTheDocument();
  });

  it("el profesor ve la lista y el tamaño del grupo, sin posición propia", async () => {
    mocks.getRankingPage.mockResolvedValue(page([item(1), item(2)], { my_position: null }));
    renderPage("teacher");
    expect(await screen.findByText("Alumno 2 P. R.")).toBeInTheDocument();
    expect(screen.queryByText("Tu posición")).not.toBeInTheDocument();
    expect(screen.getByText("Tu grupo")).toBeInTheDocument();
  });

  it("sin categorías ofrecidas no muestra el selector y con el ranking apagado avisa", async () => {
    mocks.getRankingSettings.mockResolvedValue(settings(["NOTA"]));
    mocks.getRankingPage.mockResolvedValue(page([item(1, { grade: 85.5, completed_sessions: 3 })], { type: "NOTA" }));
    renderPage();
    expect(await screen.findByText(/^85[.,]5%$/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Categoría" })).not.toBeInTheDocument();
    expect(mocks.refreshRankingCache).toHaveBeenCalledWith("NOTA");
    cleanup();
    mocks.getRankingSettings.mockResolvedValue({ ...settings([]), enabled: false });
    renderPage();
    expect(await screen.findByText("El ranking no está activado en tu institución.")).toBeInTheDocument();
    expect(within(document.body).queryByRole("button", { name: /Actualizar ranking/ })).not.toBeInTheDocument();
  });
});
