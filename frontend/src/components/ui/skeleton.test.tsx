import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  afterEach(cleanup);

  it("applies height, width and rounded", () => {
    const { container } = render(<Skeleton height={40} width="50%" rounded="full" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveStyle({ height: "40px", width: "50%" });
    expect(el).toHaveClass("rounded-full", "animate-skeleton");
  });

  it("is hidden from assistive technology and fills the width by default", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveStyle({ width: "100%", height: "16px" });
  });
});
