import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../ui/modal";
import { PortalLayout } from "./PortalLayout";
import { useLeaveWarning, usePortalFocus, type LeaveWarning } from "./portal-mode";

const logout = vi.hoisted(() => vi.fn());
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
  render(<ModalProvider><MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/estudiante" element={<PortalLayout role="student" />}>
        <Route index element={<p>Inicio</p>} />
        <Route path="cursos/:courseId" element={<p>Curso</p>} />
        <Route path="temas/:topicId/sesion" element={<Practice />} />
        <Route path="configuracion" element={<p>Ajustes</p>} />
      </Route>
    </Routes>
  </MemoryRouter></ModalProvider>);
}

const link = (name: string) => screen.getByRole("link", { name });

describe("PortalLayout", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); logout.mockReset(); });

  it("highlights Mi aprendizaje by default and on its inner pages", () => {
    renderPortal("/estudiante");
    expect(link("Mi aprendizaje")).toHaveClass("bg-primary/10");
    expect(link("Configuración")).not.toHaveClass("bg-primary/10");
    cleanup();

    renderPortal("/estudiante/cursos/curso-1");
    expect(link("Mi aprendizaje")).toHaveClass("bg-primary/10");
  });

  it("shows the access level instead of the user code", () => {
    renderPortal("/estudiante");
    expect(screen.getByText("Estudiante")).toBeInTheDocument();
    expect(screen.queryByText("ANA")).not.toBeInTheDocument();
  });

  it("highlights only Configuración on the settings page", () => {
    renderPortal("/estudiante/configuracion");
    expect(link("Configuración")).toHaveClass("bg-primary/10");
    expect(link("Mi aprendizaje")).not.toHaveClass("bg-primary/10");
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

  it("opens the mobile drawer from the hamburger", () => {
    renderPortal("/estudiante");
    expect(screen.getAllByRole("link", { name: "Mi aprendizaje" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(screen.getAllByRole("link", { name: "Mi aprendizaje" })).toHaveLength(2);
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
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(logout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salir y perder progreso" }));
    await vi.waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it("logs out directly outside a practice", () => {
    renderPortal("/estudiante");
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
