import { describe, expect, it } from "vitest";
import { AppError, normalizeError, translateDatabaseError } from "./errors";
describe("normalizeError", () => {
  it("preserves application errors", async () => {
    const error = new AppError("forbidden", "Sin permiso");
    await expect(normalizeError(error)).resolves.toBe(error);
  });
  it("translates database rules into Spanish", () => {
    const error = translateDatabaseError({ message: 'duplicate key value violates unique constraint "courses_teacher_name_unique_active_ci"' });
    expect(error).toMatchObject({ code: "database_rule", message: expect.stringContaining("ya tiene un curso con ese nombre") });
    const unknown = { message: "otro error" };
    expect(translateDatabaseError(unknown)).toBe(unknown);
  });
  it("normalizes standard errors", async () => {
    await expect(normalizeError(new Error("falló"))).resolves.toMatchObject({ code: "request_error", message: "falló" });
  });
});
