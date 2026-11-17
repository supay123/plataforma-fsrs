import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LessonText } from "./LessonText";

afterEach(cleanup);

describe("LessonText", () => {
  it("conserva los saltos de línea y renderiza las fórmulas con KaTeX", () => {
    const { container } = render(<LessonText>{"Primera línea\nSegunda línea con $x^2$"}</LessonText>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("whitespace-pre-wrap");
    expect(root.textContent).toContain("Primera línea\nSegunda línea");
    expect(container.querySelector(".katex")).not.toBeNull();
  });
});
