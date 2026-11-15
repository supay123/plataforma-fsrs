import { describe, expect, it } from "vitest";
import { dashboardAdvice } from "./dashboard-advice";

const now = new Date(2026, 10, 14, 15, 0);
const base = { courseCount: 2, lastCompletedAt: new Date(2026, 10, 13, 9, 0).toISOString(), dueReviews: 0, now };

describe("dashboardAdvice", () => {
  it("duerme si no hay cursos", () => {
    expect(dashboardAdvice({ ...base, courseCount: 0 }).event).toBe("sleep");
  });

  it("invita a la primera práctica si nunca practicó", () => {
    expect(dashboardAdvice({ ...base, lastCompletedAt: null }).text).toContain("primera práctica");
  });

  it("avisa de las preguntas por repasar, en singular y plural", () => {
    expect(dashboardAdvice({ ...base, dueReviews: 1 }).text).toContain("1 pregunta lista");
    expect(dashboardAdvice({ ...base, dueReviews: 12 }).text).toContain("12 preguntas listas");
  });

  it("celebra si ya practicó hoy", () => {
    const today = new Date(2026, 10, 14, 8, 0).toISOString();
    expect(dashboardAdvice({ ...base, lastCompletedAt: today }).event).toBe("correct");
  });

  it("duerme tras varios días sin practicar", () => {
    const longAgo = new Date(2026, 10, 9, 8, 0).toISOString();
    const advice = dashboardAdvice({ ...base, lastCompletedAt: longAgo });
    expect(advice.event).toBe("sleep");
    expect(advice.text).toContain("5 días");
  });

  it("sin repaso pendiente ni novedades, anima a seguir", () => {
    expect(dashboardAdvice({ ...base, dueReviews: null }).event).toBe("rest");
  });
});
