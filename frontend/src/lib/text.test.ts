import { describe, expect, it } from "vitest";
import { normalizeSearch } from "./text";

describe("normalizeSearch", () => {
  it("ignores case, accents and surrounding spaces", () => {
    expect(normalizeSearch("  Matemática ")).toBe("matematica");
    expect(normalizeSearch("Álgebra")).toBe("algebra");
  });

  it("matches a query inside a name", () => {
    expect(normalizeSearch("Historia del Perú").includes(normalizeSearch("peru"))).toBe(true);
  });
});
