import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { ToastProvider } from "../../components/ui/toast";
import { ImportPage } from "./ImportPage";

const mocks = vi.hoisted(() => ({
  deleteAllTopicQuestions: vi.fn(),
  deleteQuestion: vi.fn(),
  fileToBase64: vi.fn(),
  importQuestions: vi.fn(),
  listTopicQuestions: vi.fn(),
}));

vi.mock("../../features/questions/api", () => mocks);

const question = {
  id: "question-1",
  statement: "¿Cuánto es 2 + 2?",
  option_a: "3",
  option_b: "4",
  option_c: "5",
  option_d: "6",
  correct_option: "B",
  explanation: null,
  created_at: "2026-11-06T00:00:00Z",
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ModalProvider>
          <MemoryRouter initialEntries={["/profesor/temas/topic-1/importar"]}>
            <Routes>
              <Route path="/profesor/temas/:topicId/importar" element={<ImportPage />} />
            </Routes>
          </MemoryRouter>
        </ModalProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("ImportPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.listTopicQuestions.mockReset().mockResolvedValue([question]);
    mocks.deleteQuestion.mockReset().mockResolvedValue({ question_id: question.id });
    mocks.deleteAllTopicQuestions.mockReset().mockResolvedValue({ topic_id: "topic-1", archived: 1 });
    mocks.fileToBase64.mockReset().mockResolvedValue("base64");
    mocks.importQuestions.mockReset();
  });

  it("always loads and previews the topic questions", async () => {
    renderPage();

    expect(await screen.findByText(question.statement)).toBeInTheDocument();
    expect(screen.getByText("Correcta")).toBeInTheDocument();
    expect(mocks.listTopicQuestions).toHaveBeenCalledWith("topic-1");
  });

  it("shows the empty state when the topic has no questions", async () => {
    mocks.listTopicQuestions.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Este tema todavía no tiene preguntas.")).toBeInTheDocument();
    expect(mocks.listTopicQuestions).toHaveBeenCalledWith("topic-1");
  });

  it("deletes one question only after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: `Eliminar pregunta: ${question.statement}` }));
    expect(mocks.deleteQuestion).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Eliminar pregunta" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(mocks.deleteQuestion).toHaveBeenCalledWith(question.id));
  });

  it("deletes all topic questions only after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Eliminar todas" }));
    expect(mocks.deleteAllTopicQuestions).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Eliminar todas las preguntas" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(mocks.deleteAllTopicQuestions).toHaveBeenCalledWith("topic-1"));
  });

  it("shows the import counts after validating and hides them after confirming", async () => {
    const user = userEvent.setup();
    const report = { total: 6, accepted: 2, rejected: 3, duplicates: 1, issues: [] };
    mocks.importQuestions.mockImplementation((body: { action: string }) => Promise.resolve(
      body.action === "validate"
        ? { report, accepted_rows: [] }
        : { batch_id: "batch-1", report },
    ));
    renderPage();

    await user.upload(screen.getByLabelText("Archivo XLSX"), new File(["xlsx"], "questions.xlsx"));
    await user.click(screen.getByRole("button", { name: "Validar" }));
    const confirmButton = await screen.findByRole("button", { name: "Confirmar importación" });

    expect(screen.getByText("Válidas")).toBeInTheDocument();
    expect(screen.getByText("Rechazadas")).toBeInTheDocument();
    expect(screen.getByText("Duplicadas")).toBeInTheDocument();
    await user.click(confirmButton);

    expect(await screen.findByText("Se agregaron 2 preguntas nuevas.")).toBeInTheDocument();
    await waitFor(() => expect(confirmButton).toBeDisabled());
    expect(screen.queryByText("Válidas")).not.toBeInTheDocument();
    expect(screen.queryByText("Rechazadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Duplicadas")).not.toBeInTheDocument();
    expect(mocks.importQuestions).toHaveBeenLastCalledWith(expect.objectContaining({ action: "confirm" }));
  });
});
