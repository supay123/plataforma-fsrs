import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "./modal";
import { useModal, type ModalOptions, type ModalVariant } from "./use-modal";

function Opener({ variant, options }: { variant: ModalVariant; options: ModalOptions }) {
  const modal = useModal();
  return <button type="button" onClick={() => modal[variant](options)}>Abrir</button>;
}

function renderOpener(variant: ModalVariant, options: Partial<ModalOptions> = {}) {
  const onConfirm = options.onConfirm ?? vi.fn();
  render(<ModalProvider><Opener variant={variant} options={{ title: "Título", body: <p>Cuerpo del modal</p>, ...options, onConfirm }} /></ModalProvider>);
  return { onConfirm };
}

describe("Modal", () => {
  afterEach(cleanup);

  it("opens a delete modal with its title, body and labels", async () => {
    const user = userEvent.setup();
    renderOpener("delete", { title: "Eliminar colegio" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("dialog", { name: "Eliminar colegio" })).toBeInTheDocument();
    expect(screen.getByText("Cuerpo del modal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toHaveClass("bg-rose-600");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("uses Crear by default and accepts a custom confirm label", async () => {
    const user = userEvent.setup();
    renderOpener("create");
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("button", { name: "Crear" })).toHaveClass("bg-indigo-600");
    cleanup();

    renderOpener("create", { confirmLabel: "Continuar" });
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
  });

  it("opens a warning modal with Confirmar by default", async () => {
    const user = userEvent.setup();
    renderOpener("warning", { title: "Restablecer credencial" });
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("dialog", { name: "Restablecer credencial" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toHaveClass("bg-amber-600");
  });

  it("opens an informative modal with a single Entendido button", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderOpener("info", { title: "Ayuda" });
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("dialog", { name: "Ayuda" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entendido" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Entendido" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // El modal informativo no ejecuta ninguna acción.
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("closes after the action succeeds and blocks the buttons while it runs", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    const { onConfirm } = renderOpener("delete", { onConfirm: vi.fn(() => new Promise<void>((resolve) => { finish = resolve; })) });
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Eliminando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    finish();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("stays open when the action fails so it can be retried", async () => {
    const user = userEvent.setup();
    renderOpener("create", { onConfirm: vi.fn().mockRejectedValueOnce(new Error("falló")) });
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.click(screen.getByRole("button", { name: "Crear" }));
    expect(await screen.findByRole("button", { name: "Crear" })).toBeEnabled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes with Cancelar, Escape or the backdrop without running the action", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderOpener("delete");
    for (const close of [
      () => user.click(screen.getByRole("button", { name: "Cancelar" })),
      () => user.keyboard("{Escape}"),
      () => user.click(screen.getByRole("button", { name: "Cerrar diálogo" })),
    ]) {
      await user.click(screen.getByRole("button", { name: "Abrir" }));
      await close();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
