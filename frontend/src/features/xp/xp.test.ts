import { describe, expect, it } from "vitest";
import type { XpRules } from "../../types/contracts";
import { answerXp, buildLevelSegments, streakLabel, trailingStreak, xpForLevel } from "./xp";

const rules: XpRules = { xp_per_correct: 75, streak_3_bonus: 15, streak_7_bonus: 42, streak_20_bonus: 137, level: 0, xp: 0, xp_to_next: 100 };

describe("xp preview", () => {
  it("pays the streak bonus only on the 3rd, 7th and 20th correct answer in a row", () => {
    const bonuses = Array.from({ length: 20 }, (_, i) => answerXp(i + 1, rules).bonus);
    expect(bonuses.map((bonus, i) => (bonus ? [i + 1, bonus] : null)).filter(Boolean)).toEqual([[3, 15], [7, 42], [20, 137]]);
  });

  it("counts the correct answers at the end of the list", () => {
    expect(trailingStreak([true, true, false, true, true, true])).toBe(3);
    expect(trailingStreak([true, false])).toBe(0);
    expect(trailingStreak([])).toBe(0);
  });
});

describe("streakLabel", () => {
  it("names each streak in words", () => {
    expect([3, 7, 20].map(streakLabel)).toEqual(["Tres seguidas", "Siete seguidas", "Veinte seguidas"]);
  });
});

describe("buildLevelSegments", () => {
  it("fills the bar inside one level without leveling up", () => {
    expect(buildLevelSegments({ level_before: 0, xp_before: 10, xp: 60, thresholds: [100] }))
      .toEqual([{ level: 0, from: 0.1, to: 0.6, levelUp: false }]);
  });

  it("goes through every level crossed (0 xp 90 + 75 = level 1 xp 65)", () => {
    expect(buildLevelSegments({ level_before: 0, xp_before: 90, xp: 65, thresholds: [100, 120] })).toEqual([
      { level: 0, from: 0.9, to: 1, levelUp: true },
      { level: 1, from: 0, to: 65 / 120, levelUp: false },
    ]);
  });
});

describe("xpForLevel", () => {
  it("coincide con la fórmula de la BD con los valores por defecto", () => {
    expect([1, 2, 3].map((level) => xpForLevel(level, 100, 0.2))).toEqual([100, 120, 145]);
  });
});
