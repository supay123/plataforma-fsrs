import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalLayout } from "./PortalLayout";

vi.mock("../../features/auth/AuthProvider", () => ({
  useAuth: () => ({ profile: { full_name: "Ana Quispe", user_code: "ANA", role: "student" }, logout: vi.fn() }),
}));

function renderPortal(path: string) {
  render(<MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/estudiante" element={<PortalLayout role="student" />}>
        <Route index element={<p>Inicio</p>} />
        <Route path="cursos/:courseId" element={<p>Curso</p>} />
        <Route path="configuracion" element={<p>Ajustes</p>} />
      </Route>
    </Routes>
  </MemoryRouter>);
}

const link = (name: string) => screen.getByRole("link", { name });

describe("PortalLayout", () => {
  afterEach(cleanup);

  it("highlights Mi progreso by default and on its inner pages", () => {
    renderPortal("/estudiante");
    expect(link("Mi progreso")).toHaveClass("bg-indigo-500");
    expect(link("Configuración")).not.toHaveClass("bg-indigo-500");
    cleanup();

    renderPortal("/estudiante/cursos/curso-1");
    expect(link("Mi progreso")).toHaveClass("bg-indigo-500");
  });

  it("shows the access level instead of the user code", () => {
    renderPortal("/estudiante");
    expect(screen.getByText("Estudiante")).toBeInTheDocument();
    expect(screen.queryByText("ANA")).not.toBeInTheDocument();
  });

  it("highlights only Configuración on the settings page", () => {
    renderPortal("/estudiante/configuracion");
    expect(link("Configuración")).toHaveClass("bg-indigo-500");
    expect(link("Mi progreso")).not.toHaveClass("bg-indigo-500");
  });
});
