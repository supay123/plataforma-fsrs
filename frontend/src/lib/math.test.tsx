import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MathText } from "./math";

describe("MathText", () => {
  it("renders normal text and formulas", () => {
    render(<MathText>El resultado es $2+2=4$.</MathText>);
    expect(screen.getByText(/El resultado/)).toBeInTheDocument();
    expect(document.querySelector(".katex")).toBeInTheDocument();
  });
  it("falls back when LaTeX is invalid", () => {
    render(<MathText children={"Valor $\\invalid{$"} />);
    expect(document.querySelector("code")).toBeInTheDocument();
  });
});
