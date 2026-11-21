import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { pageCount } from "./page-count";
import { PaginatedText } from "./PaginatedText";

afterEach(cleanup);

describe("pageCount", () => {
  it("cuenta una página por cada ancho de columna", () => {
    expect(pageCount(1200, 400)).toBe(3);
    expect(pageCount(400, 400)).toBe(1);
  });
  it("devuelve una página cuando aún no hay medidas", () => {
    expect(pageCount(0, 0)).toBe(1);
  });
});

describe("PaginatedText", () => {
  it("con una sola página muestra la acción final y deshabilita Anterior", () => {
    render(<PaginatedText lastPageAction={<button>Ir a las preguntas</button>}>{"Texto corto"}</PaginatedText>);
    expect(screen.getByText("Texto corto")).toBeTruthy();
    expect(screen.getByText("Página 1 de 1")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Anterior" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Ir a las preguntas" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByText("Página 1 de 1")).toBeTruthy();
  });
});
