import assert from "node:assert/strict";
import { scheduleAnswer, toFsrsCard } from "./fsrs.ts";

const config = {
  library_name: "ts-fsrs",
  library_version: "5.4.1",
  parameters: {
    enable_fuzz: false,
  },
};

Deno.test("creates a deterministic first Good review using the pinned FSRS version", () => {
  const now = new Date("2026-07-26T15:00:00.000Z");
  const result = scheduleAnswer(null, config, true, now);
  assert.equal(result.reps, 1);
  assert.equal(result.lapses, 0);
  assert.equal(result.last_review, now.toISOString());
  assert.ok(new Date(String(result.due)).getTime() > now.getTime());
});

Deno.test("maps an incorrect response to an Again transition", () => {
  const now = new Date("2026-07-26T15:00:00.000Z");
  const result = scheduleAnswer(null, config, false, now);
  assert.equal(result.reps, 1);
  assert.equal(result.state, 1);
  assert.equal(result.last_review, now.toISOString());
});

Deno.test("reconstructs a persisted FSRS card", () => {
  const card = toFsrsCard({
    due_at: "2026-07-28T15:00:00.000Z",
    stability: "2.5",
    difficulty: "6.1",
    elapsed_days: 2,
    scheduled_days: 2,
    learning_steps: 0,
    reps: 3,
    lapses: 1,
    state: 2,
    last_review_at: "2026-07-26T15:00:00.000Z",
  }, new Date());
  assert.equal(card.stability, 2.5);
  assert.equal(card.reps, 3);
  assert.equal(card.last_review?.toISOString(), "2026-07-26T15:00:00.000Z");
});
