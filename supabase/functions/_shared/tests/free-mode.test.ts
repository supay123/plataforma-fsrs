import assert from "node:assert/strict";
import { AppError } from "../errors.ts";
import {
  buildCatalog,
  isDemoCollegeCode,
  leadLogLine,
  leadSheetRow,
  parseLeadRequest,
  pickRandom,
} from "../free-mode.ts";
import { GoogleSheetsError } from "../google-sheets.ts";

const validLead = {
  given_names: "María José",
  family_names: "Quispe Huamán",
  email: "Maria@Example.com",
  phone: "+51 987 654 321",
  accepted_data_policy: true,
};

Deno.test("recognizes the reserved demo college code in any case", () => {
  assert.equal(isDemoCollegeCode("CHANCON-DEMO"), true);
  assert.equal(isDemoCollegeCode("  chancon-demo "), true);
  assert.equal(isDemoCollegeCode("CHANCON-PARTICULAR"), false);
});

Deno.test("catalog keeps only topics with enough questions", () => {
  const catalog = buildCatalog({
    teachers: [
      { id: "t1", full_name: "Grupo A" },
      { id: "t2", full_name: "Grupo sin temas" },
    ],
    courses: [
      { id: "c1", teacher_id: "t1", name: "Álgebra" },
      { id: "c2", teacher_id: "t1", name: "Curso vacío" },
      { id: "c3", teacher_id: "t2", name: "Geometría" },
    ],
    topics: [
      { id: "p2", course_id: "c1", name: "Segundo", position: 2 },
      { id: "p1", course_id: "c1", name: "Primero", position: 1 },
      { id: "p3", course_id: "c2", name: "Pocas preguntas", position: 1 },
      { id: "p4", course_id: "c3", name: "Sin preguntas", position: 1 },
    ],
    questionCounts: new Map([["p1", 12], ["p2", 10], ["p3", 9]]),
  });
  assert.deepEqual(catalog, [{
    id: "t1",
    name: "Grupo A",
    courses: [{
      id: "c1",
      name: "Álgebra",
      topics: [{ id: "p1", name: "Primero" }, { id: "p2", name: "Segundo" }],
    }],
  }]);
});

Deno.test("pickRandom returns distinct items and does not mutate the input", () => {
  const items = Array.from({ length: 30 }, (_, index) => index);
  const picked = pickRandom(items, 10);
  assert.equal(picked.length, 10);
  assert.equal(new Set(picked).size, 10);
  assert.deepEqual(items, Array.from({ length: 30 }, (_, index) => index));
  assert.equal(pickRandom([1, 2], 10).length, 2);
});

Deno.test("parses a lead and normalizes email and phone", () => {
  const parsed = parseLeadRequest(validLead);
  assert.deepEqual(parsed, {
    kind: "lead",
    lead: {
      given_names: "María José",
      family_names: "Quispe Huamán",
      email: "maria@example.com",
      phone: "987654321",
    },
  });
});

Deno.test("a filled honeypot is detected before any other validation", () => {
  assert.deepEqual(
    parseLeadRequest({ website: "http://spam.example", email: "x" }),
    { kind: "honeypot" },
  );
});

Deno.test("rejects a lead without consent or with invalid data", () => {
  assert.throws(
    () => parseLeadRequest({ ...validLead, accepted_data_policy: false }),
    (error) => error instanceof AppError && error.code === "consent_required",
  );
  for (
    const invalid of [
      { phone: "812345678" },
      { phone: "98765432" },
      { email: "sin-arroba" },
      { given_names: "" },
      { family_names: "R2D2" },
    ]
  ) {
    assert.throws(
      () => parseLeadRequest({ ...validLead, ...invalid }),
      (error) => error instanceof AppError && error.status === 400,
    );
  }
});

Deno.test("sheet row lists date in Lima time, names, email and WhatsApp", () => {
  const row = leadSheetRow(
    {
      given_names: "Ana",
      family_names: "Pérez",
      email: "ana@example.com",
      phone: "987654321",
    },
    new Date("2026-11-16T20:05:09Z"),
  );
  assert.deepEqual(row, [
    "2026-11-16 15:05:09",
    "Ana",
    "Pérez",
    "ana@example.com",
    "+51987654321",
  ]);
});

Deno.test("lead log line carries event, request id, status and message only", () => {
  const line = JSON.parse(leadLogLine(
    "free_mode.lead_sheet_failed",
    "req-1",
    new GoogleSheetsError(
      403,
      "Request had insufficient authentication scopes.",
    ),
  ));
  assert.deepEqual(line, {
    event: "free_mode.lead_sheet_failed",
    request_id: "req-1",
    status: 403,
    message: "Request had insufficient authentication scopes.",
  });
});

Deno.test("lead log line without a cause has no status or message", () => {
  assert.deepEqual(
    JSON.parse(leadLogLine("free_mode.lead_sheet_not_configured", "req-2")),
    { event: "free_mode.lead_sheet_not_configured", request_id: "req-2" },
  );
});
