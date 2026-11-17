import assert from "node:assert/strict";
import { addDays, computeStreak, limaCalendarDay } from "../streak.ts";

Deno.test("the calendar day follows America/Lima, not UTC", () => {
  // 02:30 UTC del 16 sigue siendo la noche del 15 en Lima (UTC-5).
  assert.equal(limaCalendarDay(new Date("2026-11-16T02:30:00Z")), "2026-11-15");
  assert.equal(limaCalendarDay(new Date("2026-11-16T05:00:00Z")), "2026-11-16");
  assert.equal(limaCalendarDay(new Date("2026-11-16T04:59:59Z")), "2026-11-15");
});

Deno.test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
});

Deno.test("no activity gives an empty streak", () => {
  assert.deepEqual(computeStreak([], "2026-11-16"), {
    current_streak: 0,
    best_streak: 0,
    active_today: false,
    last_active_date: null,
  });
});

Deno.test("consecutive days ending today count as the current streak", () => {
  const summary = computeStreak(
    ["2026-11-14", "2026-11-15", "2026-11-16"],
    "2026-11-16",
  );
  assert.equal(summary.current_streak, 3);
  assert.equal(summary.active_today, true);
});

Deno.test("the streak stays alive when only yesterday was active", () => {
  const summary = computeStreak(["2026-11-14", "2026-11-15"], "2026-11-16");
  assert.equal(summary.current_streak, 2);
  assert.equal(summary.active_today, false);
});

Deno.test("missing yesterday and today resets the current streak but keeps the best", () => {
  const summary = computeStreak([
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
    "2026-11-13",
  ], "2026-11-16");
  assert.equal(summary.current_streak, 0);
  assert.equal(summary.best_streak, 3);
  assert.equal(summary.last_active_date, "2026-11-13");
});

Deno.test("duplicates and unsorted input are tolerated", () => {
  const summary = computeStreak([
    "2026-11-16",
    "2026-11-15",
    "2026-11-16",
    "2026-11-14",
  ], "2026-11-16");
  assert.equal(summary.current_streak, 3);
  assert.equal(summary.best_streak, 3);
});
