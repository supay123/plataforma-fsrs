import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { FreeQuestionRunner } from "./FreeQuestionRunner";
import type { FreeModeQuestion } from "./api";

vi.mock("../sessions/PracticeMascot", () => ({ PracticeMascot: () => null }));

const questions: FreeModeQuestion[] = [
  { id: "q1", statement: "Uno más uno", option_a: "1", option_b: "2", option_c: "3", option_d: "4", correct_option: "B", explanation: "Se suman." },
  { id: "q2", statement: "Dos más dos", option_a: "3", option_b: "5", option_c: "4", option_d: "6", correct_option: "C", explanation: null },
];

describe("FreeQuestionRunner", () => {
  afterEach(cleanup);

  it("corrects each answer instantly and reports every answer at the end", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<ModalProvider><FreeQuestionRunner questions={questions} onFinish={onFinish} /></ModalProvider>);

    expect(screen.getByText("Pregunta 1 de 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^A/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    expect(screen.getByText("Mal. La respuesta era la B")).toBeInTheDocument();
    expect(screen.queryByText("Se suman.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver explicación" }));
    expect(screen.getByText("Se suman.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Pregunta 2 de 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^C4/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar respuesta" }));
    expect(screen.getAllByText("Respuesta correcta")[0]).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finalizar práctica" }));
    expect(onFinish).toHaveBeenCalledWith({ q1: "A", q2: "C" });
  });
});
