import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  QUESTION_COLUMNS,
  rowsFromWorkbook,
  validateQuestionRows,
} from "../questions.ts";

const validRow = {
  pregunta: "¿Cuánto es $2+2$?",
  respuesta_a: "3",
  respuesta_b: "4",
  respuesta_c: "5",
  respuesta_d: "6",
  respuesta_correcta: "B",
  explicacion: "$2+2=4$",
};

Deno.test("accepts an empty explanation and rejects invalid answer rows", () => {
  const result = validateQuestionRows([
    validRow,
    { ...validRow, pregunta: "Otra pregunta", explicacion: "" },
    { ...validRow, pregunta: "Tercera", respuesta_correcta: "Z" },
    { ...validRow, pregunta: "  ¿CUÁNTO   ES $2+2$? " },
  ]);

  assert.equal(result.total, 4);
  assert.equal(result.accepted.length, 2);
  assert.equal(result.accepted[1]?.explicacion, "");
  assert.equal(result.rejected, 2);
  assert.equal(result.duplicates, 1);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["invalid_correct_answer", "duplicate"],
  );
});

Deno.test("rejects rows beyond the 50-question topic limit", () => {
  const result = validateQuestionRows(
    [
      { ...validRow, pregunta: "Question 49" },
      { ...validRow, pregunta: "Question 50" },
    ],
    [],
    49,
  );
  assert.equal(result.accepted.length, 1);
  assert.equal(result.issues[0]?.code, "topic_limit");
});

Deno.test("parses the official XLSX header and rows", async () => {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...QUESTION_COLUMNS],
    QUESTION_COLUMNS.map((column) => validRow[column]),
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Preguntas");
  const bytes = new Uint8Array(
    XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    }) as ArrayBuffer,
  );
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  const rows = await rowsFromWorkbook(btoa(binary));
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], validRow);
});
