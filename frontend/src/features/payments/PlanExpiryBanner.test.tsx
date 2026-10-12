import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { todayInLima } from "../../lib/dates";
import type { Profile } from "../../types/contracts";
import { PlanExpiryBanner } from "./PlanExpiryBanner";

function inDays(days: number) {
  const date = new Date(`${todayInLima()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function renderBanner(daysLeft: number) {
  const profile = { id: "s1", college_id: "c1", role: "student", user_code: "ana", full_name: "Ana", is_active: true, access_valid_from: inDays(-30), access_valid_until: inDays(daysLeft), security_question: null } as Profile;
  return render(<MemoryRouter><PlanExpiryBanner profile={profile} /></MemoryRouter>);
}

describe("PlanExpiryBanner", () => {
  afterEach(cleanup);

  it("asks to renew from three days before the plan ends", () => {
    renderBanner(3);
    expect(screen.getByRole("status")).toHaveTextContent("Tu plan vence en 3 días");
    expect(screen.getByRole("link", { name: "Renovar" })).toHaveAttribute("href", "/estudiante/renovar");
  });

  it("says when the plan ends today", () => {
    renderBanner(0);
    expect(screen.getByRole("status")).toHaveTextContent("Tu plan vence hoy");
  });

  it("stays hidden while more than three days remain", () => {
    renderBanner(4);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
