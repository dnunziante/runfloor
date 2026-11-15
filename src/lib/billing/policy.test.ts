import { test } from "node:test";
import assert from "node:assert/strict";
import { availableCredits, billingAccess, trialDaysRemaining, trialMilestone, type LocationBilling } from "./policy.ts";
const now = Date.parse("2026-11-14T12:00:00Z");
const base: LocationBilling = { location_id: "location", organization_id: "organization", status: "trialing", trial_started_at: "2026-11-14T12:00:00Z", trial_ends_at: "2026-11-21T12:00:00Z", included_credits: 100, purchased_credits: 0, period_start: null, period_end: null, cancel_at: null, stripe_customer_id: null, stripe_subscription_id: null };
test("trial expires at its exact UTC timestamp, including across daylight saving changes", () => {
  assert.equal(trialDaysRemaining(base, now), 7);
  const end = Date.parse(base.trial_ends_at);
  assert.equal(billingAccess(base, end - 1), true);
  assert.equal(billingAccess(base, end), false);
  assert.equal(availableCredits(base, end), 0);
});
test("exhausted AI credits do not end non-AI trial access", () => {
  const row = { ...base, included_credits: 0 };
  assert.equal(availableCredits(row, now), 0);
  assert.equal(billingAccess(row, now), true);
});
test("scheduled cancellation keeps paid access until the paid-through timestamp", () => {
  const row = { ...base, status: "active", period_end: base.trial_ends_at, cancel_at: base.trial_ends_at, included_credits: 2000, purchased_credits: 500 };
  assert.equal(availableCredits(row, now), 2500);
  assert.equal(billingAccess(row, Date.parse(row.period_end)), false);
  assert.equal(billingAccess({ ...row, status: "canceled" }, now), false);
});
test("subscription status alone cannot activate paid access before a verified paid period", () => {
  assert.equal(billingAccess({ ...base, status: "active" }, now), false);
  assert.equal(billingAccess({ ...base, status: "unpaid", period_end: base.trial_ends_at }, now), false);
});
test("trial reminder milestones use the real expiration timestamp", () => {
  const end = Date.parse(base.trial_ends_at);
  assert.equal(trialMilestone(base, now), "welcome");
  assert.equal(trialMilestone(base, end - 2 * 86400000), "two_days");
  assert.equal(trialMilestone(base, end - 86400000), "one_day");
  assert.equal(trialMilestone(base, end), "expired");
  assert.equal(trialMilestone({ ...base, status: "active" }, now), null);
});
