import type { RouteLessonContent, RouteLessonJson } from "./api";

/** Ejemplo que ve el administrador: un banco de 3 preguntas de las que se muestran 2. */
export const ROUTE_LESSON_JSON_EXAMPLE = JSON.stringify({
  text: "La probabilidad mide qué tan posible es un suceso.\n\nSe calcula como casos favorables entre casos posibles: $P(A)=\\frac{f}{n}$.\n\nEjemplo: al lanzar un dado, $P(6)=\\frac{1}{6}$.",
  questions_to_show: 5,
  questions: [
    { statement: "¿Cuál es la probabilidad de sacar 6 en un dado?", option_a: "1/2", option_b: "1/3", option_c: "1/6", option_d: "6", correct_option: "C", explanation: "Hay 1 caso favorable entre 6 posibles." },
    { statement: "¿Qué valor NO puede tener una probabilidad?", option_a: "0", option_b: "0.5", option_c: "1", option_d: "1.5", correct_option: "D" },
    { statement: "Al lanzar una moneda, ¿cuál es la probabilidad de cara?", option_a: "1/2", option_b: "1/4", option_c: "1", option_d: "0", correct_option: "A" },
    { statement: "¿Cuál es la probabilidad de sacar 6 en un dado?", option_a: "1/2", option_b: "1/3", option_c: "1/6", option_d: "6", correct_option: "C", explanation: "Hay 1 caso favorable entre 6 posibles." },
    { statement: "¿Qué valor NO puede tener una probabilidad?", option_a: "0", option_b: "0.5", option_c: "1", option_d: "1.5", correct_option: "D" },
    { statement: "Al lanzar una moneda, ¿cuál es la probabilidad de cara?", option_a: "1/2", option_b: "1/4", option_c: "1", option_d: "0", correct_option: "A" },
  ],
}, null, 2);

/** JSON de una lección guardada, para corregirla y volver a guardarla. */
export function lessonToJson(content: RouteLessonContent): string {
  const lesson: RouteLessonJson = {
    text: content.lesson.content_text,
    questions_to_show: content.lesson.questions_to_show,
    questions: content.questions.map((question) => ({
      statement: question.statement,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_option: question.correct_option ?? "A",
      ...(question.explanation ? { explanation: question.explanation } : {}),
    })),
  };
  return JSON.stringify(lesson, null, 2);
}

/**
 * JSON estricto no admite Enter dentro de un texto entre comillas; aquí se aceptan
 * y se convierten en `\n` para que el administrador pueda escribir párrafos normales.
 */
export function escapeRawLineBreaks(text: string): string {
  let result = "";
  let insideString = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (insideString && character === "\\") {
      result += character + (text[index + 1] ?? "");
      index++;
    } else if (character === '"') {
      insideString = !insideString;
      result += character;
    } else if (insideString && character === "\n") {
      result += "\\n";
    } else if (insideString && character === "\r") {
      // El \r de un salto de línea de Windows se descarta: el \n que lo sigue ya lo representa.
    } else {
      result += character;
    }
  }
  return result;
}

/** Lee el texto pegado; devuelve el valor o el motivo del error de sintaxis en español. */
export function readJsonText(text: string): { value: unknown } | { error: string } {
  try {
    return { value: JSON.parse(escapeRawLineBreaks(text)) };
  } catch (error) {
    return { error: `El JSON no es válido: ${error instanceof Error ? error.message : "revisa comas y comillas"}.` };
  }
}
