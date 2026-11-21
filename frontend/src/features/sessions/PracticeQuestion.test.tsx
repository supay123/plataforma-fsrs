import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { PracticeQuestion as Question, type PracticeQuestionProps } from "./PracticeQuestion";

vi.mock("./PracticeMascot", () => ({ PracticeMascot: () => null }));

const PracticeQuestion = (props: PracticeQuestionProps) => <ModalProvider><Question {...props} /></ModalProvider>;

const base: PracticeQuestionProps = {
  progressLabel: "Avance", progressValue: 0, streak: 0, eyebrow: "Pregunta 1 de 2", statement: "Uno más uno",
  options: [["A", "1"], ["B", "2"], ["C", "3"], ["D", "4"]], selected: null, chosen: null, feedback: null, onSelect: () => {}, actions: <button>Continuar</button>,
};

describe("PracticeQuestion", () => {
  afterEach(cleanup);

  it("reports the selected option and shows the actions", async () => {
    const onSelect = vi.fn();
    render(<PracticeQuestion {...base} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /^B/ }));
    expect(onSelect).toHaveBeenCalledWith("B");
    expect(screen.getByText("Elige una opción y confírmala.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
  });

  it("shows the correction, offers the explanation when wrong and locks the options", async () => {
    render(<PracticeQuestion {...base} chosen="A" feedback={{ is_correct: false, correct_option: "B", explanation: "Se suman." }} />);
    expect(screen.getByText("Mal. La respuesta era la B")).toBeInTheDocument();
    expect(screen.queryByText("Se suman.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver explicación" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Se suman.");
    expect(screen.getByText("Tu respuesta")).toBeInTheDocument();
    expect(screen.getByText("Respuesta correcta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^A/ })).toBeDisabled();
  });

  it("selects with the letters and the arrows and presses the footer button with Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onAction = vi.fn();
    const { rerender } = render(<PracticeQuestion {...base} onSelect={onSelect} actions={<button onClick={onAction}>Continuar</button>} />);

    await user.keyboard("c");
    expect(onSelect).toHaveBeenLastCalledWith("C");
    await user.keyboard("{ArrowDown}");
    expect(onSelect).toHaveBeenLastCalledWith("A");
    await user.keyboard("{ArrowUp}");
    expect(onSelect).toHaveBeenLastCalledWith("D");

    rerender(<PracticeQuestion {...base} selected="B" onSelect={onSelect} actions={<button onClick={onAction}>Continuar</button>} />);
    await user.keyboard("{ArrowDown}");
    expect(onSelect).toHaveBeenLastCalledWith("C");
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("ignores letters and arrows once the answer is corrected, but Enter still goes on", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onAction = vi.fn();
    render(<PracticeQuestion {...base} onSelect={onSelect} chosen="A" feedback={{ is_correct: true, correct_option: "A", explanation: null }} actions={<button onClick={onAction}>Continuar</button>} />);
    await user.keyboard("b{ArrowDown}");
    expect(onSelect).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("does not repeat Enter while the key is held and ignores typing in fields", async () => {
    const onAction = vi.fn();
    render(<><input aria-label="campo" /><PracticeQuestion {...base} actions={<button onClick={onAction}>Continuar</button>} /></>);
    const user = userEvent.setup();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true }));
    expect(onAction).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText("campo"));
    await user.keyboard("{Enter}");
    expect(onAction).not.toHaveBeenCalled();
  });

  it("offers the explanation behind ¿Por qué? in a modal when the answer is right", async () => {
    render(<PracticeQuestion {...base} chosen="A" feedback={{ is_correct: true, correct_option: "A", explanation: "Se suman." }} />);
    expect(screen.queryByText("Se suman.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver explicación" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "¿Por qué?" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Se suman.");
  });

  it("offers leaving with the X next to the progress bar", async () => {
    const onExit = vi.fn();
    render(<PracticeQuestion {...base} onExit={onExit} />);
    await userEvent.click(screen.getByRole("button", { name: "Salir de la práctica" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("keeps every option visible after the correction", () => {
    render(<PracticeQuestion {...base} chosen="A" feedback={{ is_correct: false, correct_option: "B", explanation: null }} />);
    for (const [letter, text] of [["A", "1"], ["B", "2"], ["C", "3"], ["D", "4"]]) expect(screen.getByRole("button", { name: new RegExp(`^${letter}${text}`) }).className).not.toContain("hidden");
  });
});
