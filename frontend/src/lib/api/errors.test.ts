import { describe, expect, it } from "vitest";
import { AppError, normalizeError } from "./errors";
describe("normalizeError", () => {
  it("preserves application errors", async () => {
    const error = new AppError("forbidden", "Sin permiso");
    await expect(normalizeError(error)).resolves.toBe(error);
  });
  it("normalizes standard errors", async () => {
    await expect(normalizeError(new Error("falló"))).resolves.toMatchObject({ code: "request_error", message: "falló" });
  });
});
