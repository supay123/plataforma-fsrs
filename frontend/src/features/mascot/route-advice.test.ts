import { describe, expect, it } from "vitest";
import { routeAdminAdvice } from "./route-advice";

describe("routeAdminAdvice", () => {
  it("pide primero la institución", () => {
    expect(routeAdminAdvice({ hasCollege: false, teacherCount: 0, hasTeacher: false }).text).toMatch(/institución/);
  });
  it("avisa si la institución no tiene profesores", () => {
    expect(routeAdminAdvice({ hasCollege: true, teacherCount: 0, hasTeacher: false }).tone).toBe("warning");
  });
  it("pide el profesor cuando ya hay institución", () => {
    expect(routeAdminAdvice({ hasCollege: true, teacherCount: 2, hasTeacher: false }).text).toMatch(/profesor/);
  });
  it("da luz verde con institución y profesor", () => {
    expect(routeAdminAdvice({ hasCollege: true, teacherCount: 2, hasTeacher: true }).tone).toBe("success");
  });
});
