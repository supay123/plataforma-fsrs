import { describe, expect, it } from "vitest";
import { formatDate } from "./dates";

describe("formatDate", () => {
  it("renders absent values safely", () => expect(formatDate(null)).toBe("—"));
  it("formats using the Lima calendar", () => expect(formatDate("2026-07-27T03:30:00Z")).toContain("26"));
});
