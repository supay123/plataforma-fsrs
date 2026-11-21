import { describe, expect, it } from "vitest";
import { escapeRawLineBreaks, lessonToJson, readJsonText, ROUTE_LESSON_JSON_EXAMPLE } from "./lesson-json";

describe("lesson-json", () => {
  it("el ejemplo es un JSON válido con un banco mayor que las preguntas a mostrar", () => {
    const parsed = readJsonText(ROUTE_LESSON_JSON_EXAMPLE);
    const lesson = ("value" in parsed ? parsed.value : null) as { questions: unknown[]; questions_to_show: number };
    expect(lesson.questions.length).toBeGreaterThan(lesson.questions_to_show);
  });

  it("explica el error cuando el JSON está mal escrito", () => {
    const parsed = readJsonText("{ text: [");
    expect("error" in parsed && parsed.error.startsWith("El JSON no es válido")).toBe(true);
  });

  it("convierte una lección guardada al mismo formato del JSON", () => {
    const json = JSON.parse(lessonToJson({
      lesson: { id: "l", topic_id: "t", position: 1, title: "Suma", content_text: "Texto", is_ready: true, questions_to_show: 1 },
      questions: [{ id: "q", position: 1, statement: "¿2+2?", option_a: "3", option_b: "4", option_c: "5", option_d: "6", correct_option: "B", explanation: null }],
    }));
    expect(json).toEqual({
      text: "Texto", questions_to_show: 1,
      questions: [{ statement: "¿2+2?", option_a: "3", option_b: "4", option_c: "5", option_d: "6", correct_option: "B" }],
    });
  });

  it("acepta Enter dentro de un texto y lo guarda como salto de línea", () => {
    const parsed = readJsonText('{ "text": "Primera línea\r\n\r\nSegundo párrafo con \\"comillas\\"", "n": 1 }');
    expect("value" in parsed && (parsed.value as { text: string }).text).toBe('Primera línea\n\nSegundo párrafo con "comillas"');
  });

  it("no toca los saltos de línea que separan los campos del JSON", () => {
    const formatted = '{\n  "a": 1\n}';
    expect(escapeRawLineBreaks(formatted)).toBe(formatted);
  });
});
