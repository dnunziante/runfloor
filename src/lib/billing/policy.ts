export const COMPLETE = { name: "RunFloor Complete", priceCents: 9900, currency: "usd", monthlyCredits: 2000, trialCredits: 100, trialDays: 7 } as const;
export type LocationBilling = {
  location_id: string; organization_id: string; trial_started_at: string; trial_ends_at: string;
  status: string; included_credits: number; purchased_credits: number;
  period_start: string | null; period_end: string | null; cancel_at: string | null;
  stripe_customer_id: string | null; stripe_subscription_id: string | null;
  risk_review_required?: boolean;
  checkout_session_id?: string | null;
};
export function billingAccess(row: LocationBilling, now = Date.now()) {
  if (row.status === "trialing") return now < Date.parse(row.trial_ends_at);
  return (row.status === "active" || row.status === "past_due") && !!row.period_end && now < Date.parse(row.period_end);
}
export function availableCredits(row: LocationBilling, now = Date.now()) {
  return billingAccess(row, now) ? row.included_credits + row.purchased_credits : 0;
}
export function trialDaysRemaining(row: LocationBilling, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(row.trial_ends_at) - now) / 86400000));
}
export function displayBillingStatus(row: LocationBilling, now = Date.now()) {
  return row.status === "trialing" && !billingAccess(row, now) ? "Expired" : row.status.replaceAll("_", " ");
}
export function trialMilestone(row: LocationBilling, now = Date.now()) {
  if (row.status !== "trialing" && row.status !== "expired") return null;
  const remaining = Date.parse(row.trial_ends_at) - now;
  return remaining <= 0 ? "expired" : remaining <= 86400000 ? "one_day" : remaining <= 2 * 86400000 ? "two_days" : "welcome";
}
export const trialMessages = {
  welcome: { title: "Welcome to RunFloor — Your 7-Day Trial Starts Now", body: "Explore RunFloor with unlimited users and 100 shared AI credits. No credit card required. Invite employees from Team Administration and use the getting-started checklist below." },
  two_days: { title: "Your RunFloor Trial Ends in 2 Days", body: "Your dealership has two days left to explore RunFloor. Keep your entire team connected with RunFloor Complete for just $99/month per location." },
  one_day: { title: "Your RunFloor Trial Ends Tomorrow", body: "Your dealership data will be preserved. Upgrade for $99/month per location for unlimited users and 2,000 monthly AI credits." },
  expired: { title: "Your RunFloor Trial Has Ended", body: "Your dealership is ready to keep moving. Activate RunFloor Complete for $99/month per location and get unlimited users plus 2,000 monthly AI credits." },
} as const;
