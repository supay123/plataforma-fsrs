import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../ui/modal";
import { PortalLayout } from "./PortalLayout";
import { useLeaveWarning, usePortalFocus, type LeaveWarning } from "./portal-mode";

const logout = vi.hoisted(() => vi.fn());
const getRankingSettings = vi.hoisted(() => vi.fn());
vi.mock("../../features/ranking/api", async (original) => ({ ...(await original<typeof import("../../features/ranking/api")>()), getRankingSettings }));
vi.mock("../../features/auth/AuthProvider", () => ({
  useAuth: () => ({ profile: { full_name: "Ana Quispe", user_code: "ANA", role: "student" }, logout }),
}));

const WARNING: LeaveWarning = { title: "¿Salir de la práctica?", body: "Perderás tu progreso.", confirmLabel: "Salir y perder progreso" };
function Practice() {
  usePortalFocus();
  useLeaveWarning(WARNING);
  return <p>Práctica</p>;
}

function renderPortal(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ModalProvider><MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/estudiante" element={<PortalLayout role="student" />}>
        <Route index element={<p>Inicio</p>} />
        <Route path="cursos/:courseId" element={<p>Curso</p>} />
        <Route path="temas/:topicId/sesion" element={<Practice />} />
        <Route path="ranking" element={<p>Clasificación</p>} />
        <Route path="configuracion" element={<p>Ajustes</p>} />
      </Route>
    </Routes>
  </MemoryRouter></ModalProvider></QueryClientProvider>);
}

// El menú lateral (escritorio) y la barra inferior (móvil) existen a la vez; el CSS oculta uno según el ancho.
const sidebar = () => within(screen.getByRole("complementary"));
const bottomBar = () => within(screen.getByRole("navigation", { name: "Principal (móvil)" }));
const link = (name: string) => sidebar().getByRole("link", { name });

describe("PortalLayout", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    getRankingSettings.mockResolvedValue({ visible: false });
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); logout.mockReset(); getRankingSettings.mockReset(); });

  it("highlights Mi aprendizaje by default and on its inner pages", () => {
    renderPortal("/estudiante");
    expect(link("Mi aprendizaje")).toHaveClass("bg-primary-soft");
    expect(link("Configuración")).not.toHaveClass("bg-primary-soft");
    cleanup();

    renderPortal("/estudiante/cursos/curso-1");
    expect(link("Mi aprendizaje")).toHaveClass("bg-primary-soft");
  });

  it("shows the access level instead of the user code", () => {
    renderPortal("/estudiante");
    expect(screen.getByText("Estudiante")).toBeInTheDocument();
    expect(screen.queryByText("ANA")).not.toBeInTheDocument();
  });

  it("highlights only Configuración on the settings page", () => {
    renderPortal("/estudiante/configuracion");
    expect(link("Configuración")).toHaveClass("bg-primary-soft");
    expect(link("Mi aprendizaje")).not.toHaveClass("bg-primary-soft");
  });

  it("collapses to icons only on desktop and remembers it", () => {
    renderPortal("/estudiante");
    fireEvent.click(screen.getByRole("button", { name: "Reducir menú" }));
    expect(screen.getByRole("button", { name: "Expandir menú" })).toBeInTheDocument();
    expect(link("Mi aprendizaje")).toHaveAttribute("title", "Mi aprendizaje");
    expect(screen.queryByText("Ana Quispe")).not.toBeInTheDocument();
    cleanup();

    renderPortal("/estudiante");
    fireEvent.click(screen.getByRole("button", { name: "Expandir menú" }));
    expect(screen.getByText("Ana Quispe")).toBeInTheDocument();
  });

  it("shows the same sections in the mobile bottom bar", () => {
    renderPortal("/estudiante");
    expect(bottomBar().getByRole("link", { name: "Mi aprendizaje" })).toHaveAttribute("aria-current", "page");
    expect(bottomBar().getByRole("link", { name: "Configuración" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });

  it("hides the bottom bar and offers leaving during a practice on mobile", () => {
    renderPortal("/estudiante/temas/tema-1/sesion");
    expect(screen.queryByRole("navigation", { name: "Principal (móvil)" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salir de la práctica" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Perderás tu progreso.");
    fireEvent.click(screen.getByRole("button", { name: "Salir y perder progreso" }));
    expect(screen.getByText("Inicio")).toBeInTheDocument();
  });

  it("reduces the menu during a practice without changing the saved preference", () => {
    renderPortal("/estudiante/temas/tema-1/sesion");
    expect(screen.getByRole("button", { name: "Expandir menú" })).toBeInTheDocument();
    expect(localStorage.getItem("portal-menu-collapsed")).toBeNull();
    fireEvent.click(link("Mi aprendizaje"));
    fireEvent.click(screen.getByRole("button", { name: "Salir y perder progreso" }));
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reducir menú" })).toBeInTheDocument();
  });

  it("warns before leaving a practice from the menu", () => {
    renderPortal("/estudiante/temas/tema-1/sesion");
    fireEvent.click(link("Configuración"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Perderás tu progreso.");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Práctica")).toBeInTheDocument();

    fireEvent.click(link("Configuración"));
    fireEvent.click(screen.getByRole("button", { name: "Salir y perder progreso" }));
    expect(screen.getByText("Ajustes")).toBeInTheDocument();
  });

  it("warns before logging out during a practice", async () => {
    renderPortal("/estudiante/temas/tema-1/sesion");
    fireEvent.click(sidebar().getByRole("button", { name: "Salir" }));
    expect(logout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salir y perder progreso" }));
    await vi.waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it("logs out directly outside a practice", () => {
    renderPortal("/estudiante");
    fireEvent.click(sidebar().getByRole("button", { name: "Salir" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("muestra Ranking solo si la institución lo activó y lo marca sin marcar Mi aprendizaje", async () => {
    renderPortal("/estudiante");
    await sidebar().findByRole("link", { name: "Configuración" });
    await vi.waitFor(() => expect(getRankingSettings).toHaveBeenCalled());
    expect(sidebar().queryByRole("link", { name: "Ranking" })).not.toBeInTheDocument();
    cleanup();
    getRankingSettings.mockResolvedValue({ visible: true });
    renderPortal("/estudiante/ranking");
    expect(await sidebar().findByRole("link", { name: "Ranking" })).toHaveClass("bg-primary-soft");
    expect(link("Mi aprendizaje")).not.toHaveClass("bg-primary-soft");
  });
});
