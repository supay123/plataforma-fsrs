import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field, Select } from "./index";

const LONG_NAME = "Grupo de preparación preuniversitaria con un nombre larguísimo que no cabe";

afterEach(cleanup);

function Controlled({ onChange = vi.fn() }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState("");
  return <Field label="Grupo">
    <Select value={value} onChange={(event) => { setValue(event.target.value); onChange(event.target.value); }}>
      <option value="">Selecciona un grupo</option>
      <option value="a">Grupo A</option>
      <option value="long">{LONG_NAME}</option>
      <option value="off" disabled>Grupo cerrado</option>
    </Select>
  </Field>;
}

describe("Select", () => {
  it("muestra la opción vacía como texto de ayuda y se nombra con la etiqueta del Field", () => {
    render(<Controlled />);
    expect(screen.getByRole("combobox", { name: "Grupo" })).toHaveTextContent("Selecciona un grupo");
  });

  it("abre el desplegable, elige con el ratón y entrega el valor por onChange", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onChange={onChange} />);
    const trigger = screen.getByRole("combobox", { name: "Grupo" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("option", { name: "Grupo A" }));
    expect(onChange).toHaveBeenCalledWith("a");
    expect(trigger).toHaveTextContent("Grupo A");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("cada opción y el botón llevan tooltip con el texto completo", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByRole("combobox", { name: "Grupo" }));
    expect(screen.getByRole("option", { name: LONG_NAME })).toHaveAttribute("title", LONG_NAME);
    await user.click(screen.getByRole("option", { name: LONG_NAME }));
    expect(screen.getByRole("combobox", { name: "Grupo" })).toHaveAttribute("title", LONG_NAME);
  });

  it("se maneja con teclado: flechas, Enter, Escape y letras; salta las opciones deshabilitadas", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const trigger = screen.getByRole("combobox", { name: "Grupo" });
    trigger.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(trigger).toHaveTextContent("Grupo A");
    await user.keyboard("{ArrowDown}{End}{Enter}");
    expect(trigger).toHaveTextContent(LONG_NAME);
    await user.keyboard("{Enter}{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.keyboard("{ArrowDown}g{Enter}");
    expect(trigger).toHaveTextContent("Grupo A");
  });

  it("no deja elegir opciones deshabilitadas", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByRole("combobox", { name: "Grupo" }));
    await user.click(screen.getByRole("option", { name: "Grupo cerrado" }));
    expect(screen.getByRole("combobox", { name: "Grupo" })).toHaveTextContent("Selecciona un grupo");
  });

  it("el botón queda deshabilitado junto con el select", () => {
    render(<Field label="Grupo"><Select disabled><option value="">Nada</option></Select></Field>);
    expect(screen.getByRole("combobox", { name: "Grupo" })).toBeDisabled();
  });

  it("pulsar la etiqueta del Field no abre el desplegable", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByText("Grupo"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("cierra al pulsar fuera", async () => {
    const user = userEvent.setup();
    const outside = vi.fn();
    render(<><Controlled /><button onClick={outside}>Fuera</button></>);
    await user.click(screen.getByRole("combobox", { name: "Grupo" }));
    await user.click(document.querySelector<HTMLElement>("body > div > div[aria-hidden]")!);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(outside).not.toHaveBeenCalled();
  });

  it("funciona sin controlar con React Hook Form: registra, lee y reinicia el valor", async () => {
    const submitted = vi.fn();
    function Form() {
      const { register, handleSubmit, reset } = useForm({ defaultValues: { group: "b" } });
      return <form onSubmit={handleSubmit(submitted)}>
        <Field label="Grupo"><Select {...register("group")}><option value="a">Grupo A</option><option value="b">Grupo B</option></Select></Field>
        <button type="button" onClick={() => reset({ group: "a" })}>Reiniciar</button>
        <button type="submit">Enviar</button>
      </form>;
    }
    const user = userEvent.setup();
    render(<Form />);
    const trigger = screen.getByRole("combobox", { name: "Grupo" });
    expect(trigger).toHaveTextContent("Grupo B");
    await user.click(screen.getByRole("button", { name: "Reiniciar" }));
    expect(trigger).toHaveTextContent("Grupo A");
    await user.click(trigger);
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Grupo B" }));
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(submitted.mock.calls[0]?.[0]).toEqual({ group: "b" });
  });

  it("acepta opciones dentro de fragmentos y arreglos", () => {
    render(<Field label="Tipo"><Select defaultValue="b"><><option value="a">Uno</option></>{["b", "c"].map((value) => <option key={value} value={value}>Opción {value}</option>)}</Select></Field>);
    expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveTextContent("Opción b");
  });
});
