import { describe, expect, it } from "vitest";
import { daysLabel, levelProgress, xpMissingForNextLevel } from "./achievements";

describe("achievements", () => {
  it("calcula el xp que falta y el avance del nivel", () => {
    expect(xpMissingForNextLevel({ xp: 40, xp_to_next: 100 })).toBe(60);
    expect(levelProgress({ xp: 40, xp_to_next: 100 })).toBe(0.4);
    expect(xpMissingForNextLevel({ xp: 120, xp_to_next: 100 })).toBe(0);
    expect(levelProgress({ xp: 0, xp_to_next: 0 })).toBe(0);
  });
  it("usa singular y plural en los días", () => {
    expect(daysLabel(1)).toBe("1 día");
    expect(daysLabel(0)).toBe("0 días");
  });
});
