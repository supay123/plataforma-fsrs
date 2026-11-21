import { describe, expect, it } from "vitest";
import { PRACTICE_TIPS, shuffleTips } from "./practice-tips";

describe("practice tips", () => {
  it("has enough unique, short tips", () => {
    expect(new Set(PRACTICE_TIPS).size).toBe(PRACTICE_TIPS.length);
    expect(PRACTICE_TIPS.length).toBeGreaterThanOrEqual(20);
    for (const tip of PRACTICE_TIPS) expect(tip.length).toBeLessThanOrEqual(100);
  });

  it("shuffles without losing or repeating tips", () => {
    expect([...shuffleTips()].sort()).toEqual([...PRACTICE_TIPS].sort());
  });

  it("does not start with the tip that was just shown", () => {
    for (let run = 0; run < 50; run++) expect(shuffleTips(PRACTICE_TIPS, PRACTICE_TIPS[0])[0]).not.toBe(PRACTICE_TIPS[0]);
  });
});
