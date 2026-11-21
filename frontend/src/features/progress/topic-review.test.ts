import { describe, expect, it } from "vitest";
import { strongestTopic, topicsToReview } from "./topic-review";

const progressRow = (topic_id: string, correct_percentage: number | null) => ({ topic_id, topic_name: topic_id, course_name: "Curso", correct_percentage, answered_questions: 10 });
const dueRow = (topic_id: string, due_questions: number, oldest_due_at: string) => ({ topic_id, topic_name: topic_id, course_name: "Curso", due_questions, oldest_due_at });

describe("strongestTopic", () => {
  it("toma el tema con mayor acierto y salta los bloqueados", () => {
    const rows = [progressRow("a", 60), progressRow("b", 95), progressRow("c", 90)];
    expect(strongestTopic(rows, [])?.topicId).toBe("b");
    expect(strongestTopic(rows, [{ topic_id: "b", is_blocked: true }])?.topicId).toBe("c");
  });
});

describe("topicsToReview", () => {
  it("ordena primero el tema con la pregunta vencida más antigua", () => {
    const result = topicsToReview([dueRow("a", 2, "2026-11-19T10:00:00Z"), dueRow("b", 9, "2026-11-18T10:00:00Z")], []);
    expect(result.map((topic) => topic.topicId)).toEqual(["b", "a"]);
    expect(result[0].dueQuestions).toBe(9);
  });

  it("ignora los temas sin preguntas vencidas y los bloqueados", () => {
    const result = topicsToReview([dueRow("a", 0, "2026-11-19T10:00:00Z"), dueRow("b", 3, "2026-11-19T10:00:00Z"), dueRow("c", 1, "2026-11-19T10:00:00Z")], [{ topic_id: "b", is_blocked: true }]);
    expect(result.map((topic) => topic.topicId)).toEqual(["c"]);
  });
});
