import { describe, expect, it } from "vitest";
import { reviewAdvice } from "./review-advice";

describe("reviewAdvice", () => {
  it("celebra una nota alta", () => {
    expect(reviewAdvice(18, 2)).toMatchObject({ event: "finish", tone: "success" });
  });

  it("anima con una nota media", () => {
    expect(reviewAdvice(12, 8).event).toBe("correct");
  });

  it("acompaña con una nota baja sin tono de error", () => {
    expect(reviewAdvice(4, 16)).toMatchObject({ event: "wrong", tone: "neutral" });
  });

  it("no divide por cero si no hay respuestas", () => {
    expect(reviewAdvice(0, 0).event).toBe("wrong");
  });
});
