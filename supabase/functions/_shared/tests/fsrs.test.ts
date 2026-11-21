import assert from "node:assert/strict";
import { scheduleAnswer, toFsrsCard } from "../fsrs.ts";

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

const dailyStepsConfig = {
  library_name: "ts-fsrs",
  library_version: "5.4.1",
  parameters: {
    learning_steps: ["12h", "1d"],
    relearning_steps: ["1d"],
    maximum_interval: 44,
  },
};

function hoursUntilDue(result: ReturnType<typeof scheduleAnswer>, from: Date) {
  return (new Date(String(result.due)).getTime() - from.getTime()) / 3600000;
}

Deno.test("a new question answered correctly returns in 1 day and incorrectly in 12 hours", () => {
  const now = new Date("2026-11-20T10:00:00.000Z");
  assert.equal(hoursUntilDue(scheduleAnswer(null, dailyStepsConfig, true, now), now), 24);
  assert.equal(hoursUntilDue(scheduleAnswer(null, dailyStepsConfig, false, now), now), 12);
});

Deno.test("an interval never exceeds 45 days", () => {
  let reviewedAt = new Date("2026-11-20T10:00:00.000Z");
  let result = scheduleAnswer(null, dailyStepsConfig, true, reviewedAt);
  for (let answer = 0; answer < 8; answer++) {
    reviewedAt = new Date(String(result.due));
    result = scheduleAnswer({
      due_at: String(result.due),
      stability: String(result.stability),
      difficulty: String(result.difficulty),
      elapsed_days: Number(result.elapsed_days),
      scheduled_days: Number(result.scheduled_days),
      learning_steps: Number(result.learning_steps),
      reps: Number(result.reps),
      lapses: Number(result.lapses),
      state: Number(result.state),
      last_review_at: String(result.last_review),
    }, dailyStepsConfig, true, reviewedAt);
    assert.ok(hoursUntilDue(result, reviewedAt) <= 45 * 24);
  }
});
