import assert from "node:assert/strict";
import {
  addDays,
  addMonths,
  RENEWAL_GRACE_DAYS,
  subscriptionPeriod,
} from "../subscription.ts";

Deno.test("adds months keeping the original billing day", () => {
  assert.equal(addMonths("2026-10-10", 1), "2026-11-10");
  assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
  assert.equal(addMonths("2027-01-31", 1), "2027-02-28");
  assert.equal(addMonths("2027-02-28", 1, 31), "2027-03-31");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

Deno.test("keeps renewing students active until the charge plus grace days", () => {
  const period = subscriptionPeriod("2026-10-10", { autoRenew: true });
  assert.deepEqual(period, {
    period_start: "2026-10-10",
    period_end: "2026-11-09",
    next_charge_date: "2026-11-10",
    access_valid_until: addDays("2026-11-10", RENEWAL_GRACE_DAYS),
  });
  assert.ok(period.access_valid_until > period.next_charge_date);
});

Deno.test("cancelled subscriptions end on the last paid day", () => {
  const period = subscriptionPeriod("2026-10-10", { autoRenew: false });
  assert.equal(period.access_valid_until, "2026-11-09");
  assert.equal(period.access_valid_until, period.period_end);
});

Deno.test("renewals start on the scheduled charge date, not the payment time", () => {
  const first = subscriptionPeriod("2027-01-31", { autoRenew: true });
  const second = subscriptionPeriod(first.next_charge_date, {
    autoRenew: true,
    anchorDay: 31,
  });
  const third = subscriptionPeriod(second.next_charge_date, {
    autoRenew: true,
    anchorDay: 31,
  });
  assert.equal(first.next_charge_date, "2027-02-28");
  assert.equal(second.next_charge_date, "2027-03-31");
  assert.equal(third.next_charge_date, "2027-04-30");
  assert.equal(second.period_start, "2027-02-28");
});
