import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StarSlots } from "./StarSlots";

describe("StarSlots", () => {
  afterEach(cleanup);
  it("anuncia la mejor marca del tema sobre 3 estrellas", () => {
    render(<StarSlots best={2} />);
    expect(screen.getByRole("img", { name: "2 de 3 estrellas" })).toBeInTheDocument();
  });
});
