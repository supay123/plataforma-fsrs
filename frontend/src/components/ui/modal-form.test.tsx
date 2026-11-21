import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalForm } from "./modal-form";

afterEach(cleanup);

function setup(overrides: Partial<Parameters<typeof ModalForm>[0]> = {}) {
  const props = {
    title: "Nuevo curso",
    confirmLabel: "Crear curso",
    onCancel: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  render(<ModalForm {...props}><label>Nombre<input /></label></ModalForm>);
  return props;
}

describe("ModalForm", () => {
  it("envía el formulario con el botón principal", async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.click(screen.getByRole("button", { name: "Crear curso" }));

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("también se envía con Enter desde un campo", async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.type(screen.getByLabelText("Nombre"), "Álgebra{Enter}");

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("cancela con el botón Cancelar, la X o Escape", async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(props.onCancel).toHaveBeenCalledTimes(2);

    await user.keyboard("{Escape}");
    expect(props.onCancel).toHaveBeenCalledTimes(3);
  });

  it("muestra el error y bloquea los botones mientras está pendiente", () => {
    setup({ pending: true, error: "No se pudo guardar" });

    expect(screen.getByText("No se pudo guardar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  });

  it("con dismissible=false no ofrece cerrarlo", async () => {
    const user = userEvent.setup();
    const props = setup({ dismissible: false });

    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar diálogo" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(props.onCancel).not.toHaveBeenCalled();
  });
});
