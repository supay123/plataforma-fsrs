import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "./toast";
import { useToast } from "./use-toast";

function Trigger() {
  const toast = useToast();
  return <>
    <button onClick={() => toast.success("Datos guardados.")}>ok</button>
    <button onClick={() => toast.error("No se pudo guardar.")}>fail</button>
  </>;
}

function renderToasts() {
  return render(<ToastProvider><Trigger /></ToastProvider>);
}

describe("toast notifications", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("shows success and error toasts with the right roles and hides them after 3.5 seconds", () => {
    renderToasts();
    fireEvent.click(screen.getByText("ok"));
    fireEvent.click(screen.getByText("fail"));
    expect(screen.getByRole("status")).toHaveTextContent("Datos guardados.");
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar.");

    act(() => vi.advanceTimersByTime(3400));
    expect(screen.getByText("Datos guardados.")).toBeInTheDocument();
    expect(screen.getByText("No se pudo guardar.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByText("Datos guardados.")).not.toBeInTheDocument();
    expect(screen.queryByText("No se pudo guardar.")).not.toBeInTheDocument();
  });

  it("closes with the x button before the time ends", () => {
    renderToasts();
    fireEvent.click(screen.getByText("fail"));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("pauses while hovered and does not stack the same message twice", () => {
    renderToasts();
    fireEvent.click(screen.getByText("ok"));
    fireEvent.click(screen.getByText("ok"));
    expect(screen.getAllByRole("status")).toHaveLength(1);

    act(() => vi.advanceTimersByTime(2000));
    fireEvent.mouseEnter(screen.getByRole("status"));
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole("status"));
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
