import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TopicsPage } from "./TopicsPage";

const mocks = vi.hoisted(() => ({
  listCourses: vi.fn(),
  listTopics: vi.fn(),
}));

vi.mock("../../features/courses/api", () => ({
  createTopic: vi.fn(),
  listCourses: mocks.listCourses,
  listTopics: mocks.listTopics,
  updateTopic: vi.fn(),
}));
vi.mock("../../features/auth/AuthProvider", () => ({
  useAuth: () => ({ profile: { id: "admin-1", role: "admin", college_id: null } }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={["/admin/cursos/course-1"]}>
      <Routes>
        <Route path="/admin/cursos/:courseId" element={<TopicsPage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>);
}

describe("TopicsPage como administrador", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.listCourses.mockReset().mockResolvedValue([{ id: "course-1", name: "Álgebra" }]);
    mocks.listTopics.mockReset().mockResolvedValue([{
      id: "topic-1", name: "Fracciones", position: 1, status: "active", material_url: null,
    }]);
  });

  it("entra al detalle del curso y abre la importación con la ruta del admin", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Álgebra" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Importar" })).toHaveAttribute("href", "/admin/temas/topic-1/importar");
  });
});
