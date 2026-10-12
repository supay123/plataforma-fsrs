import { describe, expect, it } from "vitest";
import { formatDate, formatDay } from "./dates";

describe("formatDate", () => {
  it("renders absent values safely", () => expect(formatDate(null)).toBe("—"));
  it("formats using the Lima calendar", () => expect(formatDate("2026-07-27T03:30:00Z")).toContain("26"));
});

describe("formatDay", () => {
  it("keeps the calendar day of date-only values", () => expect(formatDay("2026-12-31")).toBe("31/12/2026"));
  it("renders absent values safely", () => expect(formatDay(null)).toBe("—"));
});
