import { describe, expect, it } from "vitest";
import { routeAdminAdvice } from "./route-advice";

describe("routeAdminAdvice", () => {
  it("pide primero la institución", () => {
    expect(routeAdminAdvice({ hasCollege: false, teacherCount: 0, hasTeacher: false, courseCount: 0 }).text).toMatch(/institución/);
  });
  it("avisa si la institución no tiene profesores", () => {
    expect(routeAdminAdvice({ hasCollege: true, teacherCount: 0, hasTeacher: false, courseCount: 0 }).tone).toBe("warning");
  });
  it("pide el profesor cuando ya hay institución", () => {
    expect(routeAdminAdvice({ hasCollege: true, teacherCount: 2, hasTeacher: false, courseCount: 0 }).text).toMatch(/profesor/);
  });
  it("pide crear el primer curso si el profesor no tiene ninguno", () => {
    expect(routeAdminAdvice({ hasCollege: true, teacherCount: 2, hasTeacher: true, courseCount: 0 }).text).toMatch(/curso/);
  });
  it("da luz verde con institución, profesor y cursos", () => {
    expect(routeAdminAdvice({ hasCollege: true, teacherCount: 2, hasTeacher: true, courseCount: 1 }).tone).toBe("success");
  });
});
