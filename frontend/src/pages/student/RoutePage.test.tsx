import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { RoutePage } from "./RoutePage";

const mocks = vi.hoisted(() => ({ getRouteProgress: vi.fn() }));
vi.mock("../../features/route-mode/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/route-mode/api")>()),
  getRouteProgress: mocks.getRouteProgress,
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("RoutePage", () => {
  it("abre las lecciones disponibles y deja bloqueadas las siguientes", async () => {
    mocks.getRouteProgress.mockResolvedValue({
      pass_percent: 80,
      topics: [{
        id: "topic-1", teacher_id: "teacher-1", name: "Probabilidad", description: null, position: 1, completed_lessons: 1,
        lessons: [
          { id: "lesson-1", topic_id: "topic-1", position: 1, title: "Lo básico", status: "completed", best_percent: 100, attempts: 1 },
          { id: "lesson-2", topic_id: "topic-1", position: 2, title: "Eventos", status: "available", best_percent: null, attempts: 0 },
          { id: "lesson-3", topic_id: "topic-1", position: 3, title: "Condicional", status: "locked", best_percent: null, attempts: 0 },
        ],
      }],
    });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastProvider><MemoryRouter><RoutePage /></MemoryRouter></ToastProvider></QueryClientProvider>);
    expect(await screen.findByText("Probabilidad")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Eventos/ })).toHaveAttribute("href", "/estudiante/ruta/lecciones/lesson-2");
    expect(screen.getByText(/Mejor: 100%/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Condicional: bloqueada/)).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("link", { name: /Condicional/ })).toBeNull();
  });
});
