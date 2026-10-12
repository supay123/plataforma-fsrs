import assert from "node:assert/strict";
import { addDays, addMonths, planId, planPeriod } from "../plans.ts";
import { AppError } from "../errors.ts";

Deno.test("adds months keeping the original day", () => {
  assert.equal(addMonths("2026-10-10", 1), "2026-11-10");
  assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
  assert.equal(addMonths("2027-01-31", 1), "2027-02-28");
  assert.equal(addMonths("2027-02-28", 1, 31), "2027-03-31");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

Deno.test("the monthly plan pays one month and ends on the last paid day", () => {
  assert.deepEqual(planPeriod("2026-10-10", "mensual"), {
    period_start: "2026-10-10",
    period_end: "2026-11-09",
    next_period_start: "2026-11-10",
  });
});

Deno.test("the semester plan pays six months", () => {
  assert.deepEqual(planPeriod("2026-10-10", "semestral"), {
    period_start: "2026-10-10",
    period_end: "2027-04-09",
    next_period_start: "2027-04-10",
  });
  assert.equal(planPeriod("2026-08-31", "semestral").period_end, "2027-02-27");
});

Deno.test("renewals keep the original day across short months", () => {
  const first = planPeriod("2027-01-31", "mensual");
  const second = planPeriod(first.next_period_start, "mensual", 31);
  assert.equal(first.next_period_start, "2027-02-28");
  assert.equal(second.next_period_start, "2027-03-31");
});

Deno.test("accepts only known plans", () => {
  assert.equal(planId("semestral"), "semestral");
  for (const value of ["anual", "toString", "", null, 6]) {
    assert.throws(() => planId(value), AppError);
  }
});
