import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LessonText } from "./LessonText";

afterEach(cleanup);

describe("LessonText", () => {
  it("conserva los saltos de línea y renderiza las fórmulas con KaTeX", () => {
    const { container } = render(<LessonText>{"Primera línea\nSegunda línea con $x^2$"}</LessonText>);
    expect(container.textContent).toContain("Primera línea");
    expect(container.textContent).toContain("Segunda línea");
    expect(container.firstElementChild!.children.length).toBe(2);
    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("admite negrita, títulos y listas de Markdown sin mostrar los símbolos", () => {
    const { container } = render(<LessonText>{"# Título\nTexto **importante**\n- uno\n- dos"}</LessonText>);
    expect(container.querySelector("strong")?.textContent).toBe("importante");
    expect(container.textContent).not.toContain("#");
    expect(container.textContent).not.toContain("**");
    expect(container.textContent).toContain("•");
  });

  it("deja que una fórmula en bloque ocupe varias líneas", () => {
    const { container } = render(<LessonText>{"Antes\n$$\\frac{1}{2}\n+ 1$$\nDespués"}</LessonText>);
    expect(container.querySelectorAll(".katex-display").length).toBe(1);
  });
});
