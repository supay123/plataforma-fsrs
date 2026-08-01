import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionPayload } from "../../types/contracts";
import { SessionPage } from "./SessionPage";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  completeSession: vi.fn(),
}));

vi.mock("../../features/sessions/api", () => ({
  startSession: mocks.startSession,
  completeSession: mocks.completeSession,
}));
vi.mock("../../features/auth/AuthProvider", () => ({
  useAuth: () => ({ profile: { id: "student-1", role: "student" } }),
}));

function payload(): SessionPayload {
  return {
    session: {
      id: "session-1",
      course_id: "course-1",
      topic_id: "topic-1",
      status: "in_progress",
      started_at: new Date().toISOString(),
      total_questions: 20,
      answered_questions: 0,
    },
    questions: Array.from({ length: 20 }, (_, index) => ({
      session_question_id: `session-question-${index + 1}`,
      position: index + 1,
      selection_reason: index < 18 ? "new" : "scheduled",
      selected_option: null,
      answered_at: null,
      question: {
        id: `question-${index + 1}`,
        statement: `Pregunta ${index + 1}`,
        option_a: `Opción A ${index + 1}`,
        option_b: `Opción B ${index + 1}`,
        option_c: `Opción C ${index + 1}`,
        option_d: `Opción D ${index + 1}`,
      },
    })),
  };
}

describe("SessionPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mocks.startSession.mockReset().mockResolvedValue(payload());
    mocks.completeSession.mockReset().mockResolvedValue({ session: {} });
  });

  it("advances locally and submits one batch only at the end", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/estudiante/temas/topic-1/sesion"]}>
          <Routes>
            <Route path="/estudiante/temas/:topicId/sesion" element={<SessionPage />} />
            <Route path="/estudiante/sesiones/:sessionId/revision" element={<div>Revisión</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Pregunta 1 de 20")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anterior" })).not.toBeInTheDocument();

    for (let index = 1; index <= 19; index += 1) {
      await user.click(screen.getByRole("button", { name: new RegExp(`AOpción A ${index}$`) }));
      await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    }
    expect(mocks.completeSession).not.toHaveBeenCalled();
    expect(screen.getByText("Pregunta 20 de 20")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /AOpción A 20$/ }));
    await user.click(screen.getByRole("button", { name: "Finalizar examen" }));

    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
    expect(mocks.completeSession.mock.calls[0]?.[1]).toHaveLength(20);
    expect(await screen.findByText("Revisión")).toBeInTheDocument();
  });
});
