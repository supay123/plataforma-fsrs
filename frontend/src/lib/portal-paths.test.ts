import { describe, expect, it } from "vitest";
import { courseTopicsPath, importQuestionsPath } from "./portal-paths";

describe("portal-paths", () => {
  it("usa las rutas del profesor por defecto", () => {
    expect(courseTopicsPath(undefined, "course-1")).toBe("/profesor/cursos/course-1");
    expect(courseTopicsPath("teacher", "course-1")).toBe("/profesor/cursos/course-1");
    expect(importQuestionsPath(undefined, "topic-1")).toBe("/profesor/temas/topic-1/importar");
  });

  it("usa las rutas del administrador para el admin", () => {
    expect(courseTopicsPath("admin", "course-1")).toBe("/admin/cursos/course-1");
    expect(importQuestionsPath("admin", "topic-1")).toBe("/admin/temas/topic-1/importar");
  });
});
