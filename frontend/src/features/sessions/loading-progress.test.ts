import { describe, expect, it } from "vitest";
import { progressFor, slowNotice } from "./loading-progress";

describe("loading progress", () => {
  it("advances inside a stage without ever completing it", () => {
    expect(progressFor("downloading", 0)).toBe(5);
    expect(progressFor("downloading", 5_000)).toBeGreaterThan(progressFor("downloading", 1_000));
    expect(progressFor("downloading", 2 * 60_000)).toBeLessThan(60);
    expect(progressFor("preparing", 0)).toBe(60);
    expect(progressFor("preparing", 2 * 60_000)).toBeLessThan(95);
  });

  it("escalates the notice with the real elapsed time", () => {
    expect(slowNotice(19_999)).toBe("none");
    expect(slowNotice(20_000)).toBe("slow");
    expect(slowNotice(59_999)).toBe("slow");
    expect(slowNotice(60_000)).toBe("stuck");
  });
});
