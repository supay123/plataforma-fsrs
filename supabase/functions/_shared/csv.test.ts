import assert from "node:assert/strict";
import { csvCell, toCsv } from "./csv.ts";

Deno.test("escapes commas, quotes, and newlines in CSV cells", () => {
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
  assert.equal(csvCell(null), "");
});

Deno.test("builds a UTF-8 BOM CSV with stable columns", () => {
  const csv = toCsv([
    { id: 1, statement: "Uno, dos", correct: true },
    { id: 2, statement: 'Dice "hola"', correct: false },
  ]);
  assert.ok(csv.startsWith("\uFEFFid,statement,correct\r\n"));
  assert.ok(csv.includes('1,"Uno, dos",true'));
  assert.ok(csv.includes('2,"Dice ""hola""",false'));
});
