import assert from "node:assert/strict";
import { computeSessionXp } from "../xp.ts";

const amounts = {
  xp_per_correct: 75,
  streak_3_bonus: 15,
  streak_7_bonus: 42,
  streak_20_bonus: 137,
};
const run = (count: number) => Array.from({ length: count }, () => true);

Deno.test("two correct answers earn only the per-answer xp", () => {
  assert.equal(computeSessionXp(run(2), amounts).total, 150);
});

Deno.test("the streak of 3 is paid once, not again at 6", () => {
  const result = computeSessionXp(run(6), amounts);
  assert.deepEqual(result.streak_bonuses, [{ streak: 3, xp: 15 }]);
  assert.equal(result.total, 6 * 75 + 15);
});

Deno.test("7 in a row pays the bonus of 3 and the bonus of 7", () => {
  const result = computeSessionXp(run(7), amounts);
  assert.equal(result.total, 7 * 75 + 15 + 42);
});

Deno.test("a perfect session of 20 pays every bonus", () => {
  const result = computeSessionXp(run(20), amounts);
  assert.equal(result.total, 20 * 75 + 15 + 42 + 137);
});

Deno.test("a wrong answer resets the streak so it can be earned again", () => {
  const result = computeSessionXp(
    [...run(3), false, ...run(3)],
    amounts,
  );
  assert.deepEqual(result.streak_bonuses, [
    { streak: 3, xp: 15 },
    { streak: 3, xp: 15 },
  ]);
  assert.equal(result.total, 6 * 75 + 30);
});

Deno.test("no correct answers earn nothing", () => {
  assert.equal(computeSessionXp([false, false], amounts).total, 0);
});
