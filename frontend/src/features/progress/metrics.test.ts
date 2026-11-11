import { describe, expect, it } from "vitest";
import { averageCourseScore, formatPercentage } from "./metrics";

describe("course score metrics", () => {
  it("averages only courses with completed-session scores", () => {
    expect(averageCourseScore([51.25, 30, null, undefined])).toBe(40.625);
    expect(formatPercentage(40.625)).toBe("40.625");
  });

  it("returns no score when no course has results", () => {
    expect(averageCourseScore([null, undefined])).toBeNull();
  });
});
