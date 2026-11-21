import { describe, expect, it } from "vitest";
import { studentResultsAdvice, teacherStudentsAdvice } from "./teacher-advice";

const now = new Date(2026, 10, 14, 12, 0);
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe("teacherStudentsAdvice", () => {
  it("avisa si aún no hay estudiantes", () => {
    expect(teacherStudentsAdvice([], now).event).toBe("sleep");
  });

  it("cuenta a cada estudiante una sola vez aunque esté en varios cursos", () => {
    const rows = [
      { student_id: "a", last_completed_session_at: daysAgo(10) },
      { student_id: "a", last_completed_session_at: daysAgo(1) },
      { student_id: "b", last_completed_session_at: null },
    ];
    expect(teacherStudentsAdvice(rows, now).text).toContain("1 estudiante lleva");
  });

  it("felicita si todos practicaron", () => {
    expect(teacherStudentsAdvice([{ student_id: "a", last_completed_session_at: daysAgo(2) }], now).tone).toBe("success");
  });
});

describe("studentResultsAdvice", () => {
  it("avisa si no hay prácticas", () => {
    expect(studentResultsAdvice([], []).event).toBe("sleep");
  });

  it("señala el tema más débil y la tendencia", () => {
    const topics = [{ topic_name: "Álgebra", correct_percentage: 40 }, { topic_name: "Aritmética", correct_percentage: 80 }];
    const advice = studentResultsAdvice(topics, [80, 80, 80, 60, 60, 60]);
    expect(advice.text).toContain("Álgebra");
    expect(advice.text).toContain("mejorando");
    expect(advice.tone).toBe("warning");
  });

  it("felicita si ningún tema es débil", () => {
    const advice = studentResultsAdvice([{ topic_name: "Álgebra", correct_percentage: 75 }], [75]);
    expect(advice.tone).toBe("success");
  });
});
