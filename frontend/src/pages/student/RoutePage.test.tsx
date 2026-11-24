import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { RoutePage } from "./RoutePage";

const mocks = vi.hoisted(() => ({ getRouteProgress: vi.fn() }));
vi.mock("../../features/route-mode/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/route-mode/api")>()),
  getRouteProgress: mocks.getRouteProgress,
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); sessionStorage.clear(); });

const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastProvider><MemoryRouter><RoutePage /></MemoryRouter></ToastProvider></QueryClientProvider>);

describe("RoutePage", () => {
  it("abre las lecciones disponibles y deja bloqueadas las siguientes", async () => {
    mocks.getRouteProgress.mockResolvedValue({
      pass_percent: 80,
      courses: [{ id: "course-1", teacher_id: "teacher-1", teacher_name: "Ana", name: "Matemática", description: null, position: 1 }],
      topics: [{
        id: "topic-1", teacher_id: "teacher-1", route_course_id: "course-1", name: "Probabilidad", description: null, position: 1, completed_lessons: 1,
        lessons: [
          { id: "lesson-1", topic_id: "topic-1", position: 1, title: "Lo básico", status: "completed", best_percent: 100, attempts: 1 },
          { id: "lesson-2", topic_id: "topic-1", position: 2, title: "Eventos", status: "available", best_percent: null, attempts: 0 },
          { id: "lesson-3", topic_id: "topic-1", position: 3, title: "Condicional", status: "locked", best_percent: null, attempts: 0 },
        ],
      }],
    });
    renderPage();
    expect(await screen.findByText("Probabilidad")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Eventos/ })).toHaveAttribute("href", "/estudiante/ruta/lecciones/lesson-2");
    expect(screen.getByText(/Mejor: 100%/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Condicional: bloqueada/)).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("link", { name: /Condicional/ })).toBeNull();
  });

  it("con varios cursos muestra uno a la vez y deja cambiar entre ellos", async () => {
    const lesson = (id: string, topicId: string, title: string, status: "available" | "locked") => ({ id, topic_id: topicId, position: 1, title, status, best_percent: null, attempts: 0 });
    mocks.getRouteProgress.mockResolvedValue({
      pass_percent: 80,
      courses: [
        { id: "course-1", teacher_id: "teacher-1", teacher_name: "Ana", name: "Matemática", description: null, position: 1 },
        { id: "course-2", teacher_id: "teacher-1", teacher_name: "Ana", name: "Física", description: null, position: 2 },
        { id: "course-3", teacher_id: "teacher-1", teacher_name: "Ana", name: "Sin lecciones", description: null, position: 3 },
      ],
      topics: [
        { id: "topic-1", teacher_id: "teacher-1", route_course_id: "course-1", name: "Probabilidad", description: null, position: 1, completed_lessons: 0, lessons: [lesson("lesson-1", "topic-1", "Lo básico", "available")] },
        { id: "topic-2", teacher_id: "teacher-1", route_course_id: "course-2", name: "Cinemática", description: null, position: 1, completed_lessons: 0, lessons: [lesson("lesson-2", "topic-2", "Velocidad", "available")] },
      ],
    });
    renderPage();
    expect(await screen.findByText("Probabilidad")).toBeInTheDocument();
    expect(screen.queryByText("Cinemática")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sin lecciones" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Física" }));
    expect(await screen.findByText("Cinemática")).toBeInTheDocument();
    expect(screen.queryByText("Probabilidad")).toBeNull();
    expect(sessionStorage.getItem("routeCourseId")).toBe("course-2");
  });
});
