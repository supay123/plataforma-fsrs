import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, configure, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import type { AnswerKeyEntry, PracticePayload } from "../../types/contracts";
import { SessionPage } from "./SessionPage";

// La primera pregunta aparece tras dejar ver la barra completa (~0,8 s).
configure({ asyncUtilTimeout: 3000 });

const mocks = vi.hoisted(() => ({
  startPractice: vi.fn(),
  submitPractice: vi.fn(),
  decryptAnswerKey: vi.fn(),
  getXpRules: vi.fn(),
  calculateMedal: vi.fn(),
  getMyMedal: vi.fn(),
}));

vi.mock("../../features/sessions/api", () => ({
  startPractice: mocks.startPractice,
  submitPractice: mocks.submitPractice,
  getXpRules: mocks.getXpRules,
}));
vi.mock("../../features/medals/api", () => ({ calculateMedal: mocks.calculateMedal, getMyMedal: mocks.getMyMedal }));
// El cifrado real se prueba en answer-key.test.ts.
vi.mock("../../features/sessions/answer-key", () => ({ decryptAnswerKey: mocks.decryptAnswerKey }));

function payload(total = 3): PracticePayload {
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
    answer_key: { algorithm: "AES-GCM", key: "llave", items: {} },
  };
}

// Every question's correct option is A.
function keyFor(total = 3): Record<string, AnswerKeyEntry> {
  return Object.fromEntries(Array.from({ length: total }, (_, index) => [
    `session-question-${index + 1}`,
    { correct_option: "A", explanation: "Porque A es la correcta." },
  ]));
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ModalProvider>
      <MemoryRouter initialEntries={["/estudiante/temas/topic-1/sesion"]}>
        <Routes>
          <Route path="/estudiante/temas/:topicId/sesion" element={<SessionPage />} />
          <Route path="/estudiante/sesiones/:sessionId/revision" element={<div>Revisión</div>} />
        </Routes>
      </MemoryRouter>
      </ModalProvider>
    </QueryClientProvider>,
  );
}

describe("SessionPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.startPractice.mockReset().mockResolvedValue(payload());
    mocks.decryptAnswerKey.mockReset().mockResolvedValue(keyFor());
    mocks.submitPractice.mockReset().mockResolvedValue({ session: {} });
    mocks.calculateMedal.mockReset().mockResolvedValue({ enabled: false });
    mocks.getMyMedal.mockReset().mockResolvedValue({ enabled: false });
    mocks.getXpRules.mockReset().mockResolvedValue({
      xp_per_correct: 75, streak_3_bonus: 15, streak_7_bonus: 42, streak_20_bonus: 137, level: 0, xp: 0, xp_to_next: 100,
    });
  });

  it("shows the loading screen until the questions are decrypted", async () => {
    let resolveKey: (value: Record<string, AnswerKeyEntry>) => void = () => undefined;
    mocks.decryptAnswerKey.mockReturnValue(new Promise((resolve) => { resolveKey = resolve; }));
    renderPage();

    expect(screen.getByText("Preparando tu práctica…")).toBeInTheDocument();
    expect(await screen.findByText("Preparando tu práctica…")).toBeInTheDocument();
    resolveKey(keyFor());
    expect(await screen.findByText("Pregunta 1 de 3")).toBeInTheDocument();
    expect(screen.queryByText("Preparando tu práctica…")).not.toBeInTheDocument();
  });

  it("shows the progress bar complete before the first question", async () => {
    renderPage();

    const bar = await screen.findByRole("progressbar", { name: "Progreso de la carga" });
    await vi.waitFor(() => expect(bar).toHaveAttribute("aria-valuenow", "100"));
    expect(screen.getByText("¡Listo!")).toBeInTheDocument();
    expect(screen.queryByText("Pregunta 1 de 3")).not.toBeInTheDocument();
    expect(await screen.findByText("Pregunta 1 de 3")).toBeInTheDocument();
  });

  it("corrects locally and submits every answer once at the end", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Pregunta 1 de 3")).toBeInTheDocument();
    expect(screen.queryByText("Porque A es la correcta.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /AOpción A 1/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    expect(screen.getAllByText("Respuesta correcta")).not.toHaveLength(0);
    expect(screen.queryByText("Porque A es la correcta.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "¿Por qué?" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Porque A es la correcta.");
    await user.click(screen.getByRole("button", { name: "Entendido" }));
    expect(screen.getByRole("button", { name: /AOpción A 1/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Pregunta 2 de 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /BOpción B 2/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    expect(screen.getAllByText("Mal. La respuesta era la A")).not.toHaveLength(0);
    expect(screen.getByText("Tu respuesta")).toBeInTheDocument();
    expect(screen.getByText("Respuesta correcta")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: /COpción C 3/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    expect(mocks.submitPractice).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Finalizar examen" }));
    expect(mocks.submitPractice).toHaveBeenCalledWith("session-1", [
      expect.objectContaining({ session_question_id: "session-question-1", selected_option: "A" }),
      expect.objectContaining({ session_question_id: "session-question-2", selected_option: "B" }),
      expect.objectContaining({ session_question_id: "session-question-3", selected_option: "C" }),
    ]);
    expect(await screen.findByText("Revisión")).toBeInTheDocument();
  });

  it("shows the xp earned by each correct answer and by the streak of 3", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Pregunta 1 de 3");
    for (let question = 1; question <= 3; question += 1) {
      await user.click(screen.getByRole("button", { name: new RegExp(`AOpción A ${question}`) }));
      await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
      expect(screen.getByText("+75 xp")).toBeInTheDocument();
      if (question < 3) {
        expect(screen.queryByText(/seguidas/)).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Siguiente" }));
      }
    }
    expect(screen.getByText("Tres seguidas: +15 xp")).toBeInTheDocument();
  });

  it("keeps working without xp when the rules cannot be loaded", async () => {
    const user = userEvent.setup();
    mocks.getXpRules.mockRejectedValue(new Error("fallo"));
    renderPage();
    await user.click(await screen.findByRole("button", { name: /AOpción A 1/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    expect(screen.queryByText("+75 xp")).not.toBeInTheDocument();
    expect(screen.getAllByText("Respuesta correcta")).not.toHaveLength(0);
  });

  it("shows the xp result after finishing and then goes to the review", async () => {
    const user = userEvent.setup();
    mocks.startPractice.mockResolvedValue(payload(1));
    mocks.decryptAnswerKey.mockResolvedValue(keyFor(1));
    mocks.submitPractice.mockResolvedValue({
      session: {},
      xp: { xp_gained: 75, level_before: 0, xp_before: 90, level: 1, xp: 65, thresholds: [100, 120], breakdown: { total: 75, correct_xp: 75, streak_bonuses: [] } },
    });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /AOpción A 1/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    await user.click(screen.getByRole("button", { name: "Finalizar examen" }));
    expect(await screen.findByText("Práctica terminada")).toBeInTheDocument();
    expect(await screen.findByText("¡Subiste de nivel!", {}, { timeout: 8000 })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver revisión" }));
    expect(await screen.findByText("Revisión")).toBeInTheDocument();
  }, 15000);

  it("shows the medal and the stars earned next to the xp when the college has medals", async () => {
    const user = userEvent.setup();
    mocks.startPractice.mockResolvedValue(payload(1));
    mocks.decryptAnswerKey.mockResolvedValue(keyFor(1));
    mocks.submitPractice.mockResolvedValue({
      session: {},
      xp: { xp_gained: 75, level_before: 0, xp_before: 0, level: 0, xp: 75, thresholds: [100], breakdown: { total: 75, correct_xp: 75, streak_bonuses: [] } },
    });
    mocks.calculateMedal.mockResolvedValue({
      enabled: true, grade: 20, stars_for_grade: 3, stars_delta: 3, stars_before: 2, stars: 5, medal_before: "postulante_1", medal: "postulante_2",
      topic_id: "topic-1", topic_best_stars: 3, topic_completed: true,
    });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /AOpción A 1/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    await user.click(screen.getByRole("button", { name: "Finalizar examen" }));
    expect(await screen.findByText("Postulante II")).toBeInTheDocument();
    expect(mocks.calculateMedal).toHaveBeenCalledWith("session-1");
    expect(screen.getByText(/Ganaste 3 estrellas/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "3 de 3 estrellas" })).toBeInTheDocument();
  }, 15000);

  it("resumes on the first pending question and only submits pending ones", async () => {
    const user = userEvent.setup();
    const resumed = payload(2);
    resumed.questions[0] = {
      ...resumed.questions[0]!,
      selected_option: "B",
      answered_at: new Date().toISOString(),
      feedback: { is_correct: false, correct_option: "A", explanation: null },
    };
    mocks.startPractice.mockResolvedValue(resumed);
    mocks.decryptAnswerKey.mockResolvedValue({ "session-question-2": { correct_option: "A", explanation: null } });
    renderPage();

    expect(await screen.findByText("Pregunta 2 de 2")).toBeInTheDocument();
    expect(screen.getByText("1 respondidas")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /DOpción D 2/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    await user.click(screen.getByRole("button", { name: "Finalizar examen" }));
    expect(mocks.submitPractice).toHaveBeenCalledWith("session-1", [
      expect.objectContaining({ session_question_id: "session-question-2", selected_option: "D" }),
    ]);
  });

  it("keeps the answers and lets the student retry when saving fails", async () => {
    const user = userEvent.setup();
    mocks.startPractice.mockResolvedValue(payload(1));
    mocks.decryptAnswerKey.mockResolvedValue(keyFor(1));
    mocks.submitPractice.mockRejectedValueOnce(new Error("Sin conexión."));
    renderPage();

    await user.click(await screen.findByRole("button", { name: /AOpción A 1/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    await user.click(screen.getByRole("button", { name: "Finalizar examen" }));
    expect(await screen.findByText(/Sin conexión\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Revisión")).toBeInTheDocument();
    expect(mocks.submitPractice).toHaveBeenCalledTimes(2);
  });

  it("offers a retry when the practice cannot be loaded", async () => {
    const user = userEvent.setup();
    mocks.startPractice.mockRejectedValueOnce(new Error("Tema bloqueado."));
    renderPage();

    expect(await screen.findByText("Tema bloqueado.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Pregunta 1 de 3")).toBeInTheDocument();
  });
});
