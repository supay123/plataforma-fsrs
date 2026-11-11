import { describe, expect, it } from "vitest";
import { studentAccess } from "./student-access";

describe("studentAccess", () => {
  const today = "2026-10-12";

  it("counts the days left of an active plan, including the last day", () => {
    expect(studentAccess({ access_valid_from: "2026-10-01", access_valid_until: "2026-10-15" }, today)).toEqual({ state: "active", daysLeft: 3 });
    expect(studentAccess({ access_valid_from: "2026-10-01", access_valid_until: today }, today)).toEqual({ state: "active", daysLeft: 0 });
  });

  it("marks a plan as expired from the day after its last day", () => {
    expect(studentAccess({ access_valid_from: "2026-09-01", access_valid_until: "2026-10-11" }, today)).toEqual({ state: "expired", daysSinceExpiry: 1 });
    expect(studentAccess({ access_valid_from: "2026-08-01", access_valid_until: "2026-10-01" }, today)).toEqual({ state: "expired", daysSinceExpiry: 11 });
  });

  it("does not let in a student whose access has not started", () => {
    expect(studentAccess({ access_valid_from: "2026-10-20", access_valid_until: "2026-11-20" }, today)).toEqual({ state: "not_started" });
    expect(studentAccess({ access_valid_from: null, access_valid_until: null }, today)).toEqual({ state: "not_started" });
  });
});
