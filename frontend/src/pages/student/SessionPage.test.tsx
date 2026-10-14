import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/api/errors";
import type { AnswerOption, SessionPayload } from "../../types/contracts";
import { SessionPage } from "./SessionPage";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  answerQuestion: vi.fn(),
  completeSession: vi.fn(),
  warmAnswerQuestion: vi.fn(),
}));

vi.mock("../../features/sessions/api", () => ({
  startSession: mocks.startSession,
  answerQuestion: mocks.answerQuestion,
  completeSession: mocks.completeSession,
  warmAnswerQuestion: mocks.warmAnswerQuestion,
}));

function payload(total = 3): SessionPayload {
  return {
    session: {
      id: "session-1",
      course_id: "course-1",
      topic_id: "topic-1",
      status: "in_progress",
      started_at: new Date().toISOString(),
      total_questions: total,
      answered_questions: 0,
    },
    questions: Array.from({ length: total }, (_, index) => ({
      session_question_id: `session-question-${index + 1}`,
      position: index + 1,
      selection_reason: "new",
      selected_option: null,
      answered_at: null,
      feedback: null,
      question: {
        id: `question-${index + 1}`,
        statement: `Enunciado ${index + 1}`,
        option_a: `Opción A ${index + 1}`,
        option_b: `Opción B ${index + 1}`,
        option_c: `Opción C ${index + 1}`,
        option_d: `Opción D ${index + 1}`,
      },
    })),
  };
}

// Every question's correct option is A.
function answerResult(body: { selected_option: AnswerOption }) {
  return Promise.resolve({
    status: "accepted",
    session_id: "session-1",
    selected_option: body.selected_option,
    feedback: {
      is_correct: body.selected_option === "A",
      correct_option: "A",
      explanation: "Porque A es la correcta.",
    },
  });
}

function renderPage() {
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
}

describe("SessionPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.startSession.mockReset().mockResolvedValue(payload());
    mocks.answerQuestion.mockReset().mockImplementation(answerResult);
    mocks.completeSession.mockReset().mockResolvedValue({ session: {} });
    mocks.warmAnswerQuestion.mockReset().mockResolvedValue({ status: "ready" });
  });

  it("shows feedback after each answer and completes once everything is answered", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Pregunta 1 de 3")).toBeInTheDocument();
    expect(screen.queryByText("Porque A es la correcta.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /AOpción A 1/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    expect(await screen.findByText("¡Correcto!")).toBeInTheDocument();
    expect(screen.getByText("Porque A es la correcta.")).toBeInTheDocument();
    expect(mocks.answerQuestion).toHaveBeenCalledWith(expect.objectContaining({
      session_question_id: "session-question-1",
      selected_option: "A",
    }));
    expect(screen.getByRole("button", { name: /AOpción A 1/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Pregunta 2 de 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /BOpción B 2/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    expect(await screen.findByText("Incorrecto. La respuesta correcta es la A.")).toBeInTheDocument();
    expect(screen.getByText("Tu respuesta")).toBeInTheDocument();
    expect(screen.getByText("Respuesta correcta")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: /COpción C 3/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    expect(mocks.completeSession).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: "Finalizar examen" }));
    expect(mocks.completeSession).toHaveBeenCalledWith("session-1", []);
    expect(await screen.findByText("Revisión")).toBeInTheDocument();
  });

  it("resumes on the first pending question and keeps feedback for answered ones", async () => {
    const resumed = payload();
    resumed.questions[0] = {
      ...resumed.questions[0]!,
      selected_option: "B",
      answered_at: new Date().toISOString(),
      feedback: { is_correct: false, correct_option: "A", explanation: null },
    };
    mocks.startSession.mockResolvedValue(resumed);
    renderPage();

    expect(await screen.findByText("Pregunta 2 de 3")).toBeInTheDocument();
    expect(screen.getByText("1 respondidas")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retries the completion while the last answer is still being saved", async () => {
    const user = userEvent.setup();
    mocks.startSession.mockResolvedValue(payload(1));
    mocks.completeSession.mockReset()
      .mockRejectedValueOnce(new AppError("incomplete_submission", "Pendiente."))
      .mockResolvedValue({ session: {} });
    renderPage();

    await user.click(await screen.findByRole("button", { name: /AOpción A 1/ }));
    expect(mocks.warmAnswerQuestion).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    await user.click(await screen.findByRole("button", { name: "Finalizar examen" }));
    expect(await screen.findByText("Revisión", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(mocks.completeSession).toHaveBeenCalledTimes(2);
  });

  it("lets the student retry when the answer cannot be saved", async () => {
    const user = userEvent.setup();
    mocks.answerQuestion.mockRejectedValueOnce(new Error("Sin conexión."));
    renderPage();

    await user.click(await screen.findByRole("button", { name: /AOpción A 1/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    expect(await screen.findByText(/Sin conexión\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("¡Correcto!")).toBeInTheDocument();
    expect(mocks.answerQuestion).toHaveBeenCalledTimes(2);
  });
});
