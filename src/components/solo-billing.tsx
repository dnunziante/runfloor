import Link from "next/link";
import { AppShell } from "./app-shell";
import { startSoloCheckout, manageSoloSubscription, upgradeSolo } from "@/app/billing/solo-actions";
import type { SoloSummary } from "@/lib/plans/data";
import { planPaid, isFreeSolo } from "@/lib/plans/policy";
const dollars = (units: number) => (units / 100_000_000).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
export function SoloBilling({ summary: s, error, checkout }: { summary: SoloSummary; error?: string; checkout?: string }) {
  const paid = !isFreeSolo(s) && planPaid(s);
  return <AppShell title="Subscription & Billing"><div className="rv-billing"><header><p className="lp-kicker">{paid ? "RUNFLOOR SALES SOLO" : "RUNFLOOR SALES SOLO FREE"}</p><h1>Your Sales workspace.</h1><p>{paid ? "$25/month · One user · Up to $5 of AI provider cost per paid month" : "$0 browsing and comparisons · One user · Upgrade for $25/month"}</p></header>
    {error && <p role="alert" className="rv-billing-alert">{error.slice(0, 200)}</p>}
    {checkout && <p role="status" className="rv-billing-alert">Your payment or plan change is being confirmed. Access changes only after verified payment.</p>}
    {!paid && <section className="rv-billing-card"><h2>Your free account stays available.</h2><p>Browse the authorized shared catalog and compare specifications without AI, a credit card, or a subscription. Your saved business records are preserved if a paid subscription ends.</p><Link className="btn" href="/products">Browse inventory</Link><Link className="btn" href="/comparisons">Compare models</Link></section>}
    <section className="rv-billing-card"><div className="rv-billing-heading"><h2>{paid ? "Sales Solo" : "Sales Solo Free"}</h2><span className="badge">{paid ? "Active" : "Free · $0"}</span></div>
      <dl className="rv-billing-facts"><div><dt>Subscription</dt><dd>{s.plan_key === "sales_solo_free" ? s.stripe_subscription_id ? "Awaiting verified payment" : "No subscription required" : s.status.replaceAll("_", " ")}</dd></div><div><dt>Users</dt><dd>{s.user_count} / {s.seat_limit}</dd></div><div><dt>AI cost allowance</dt><dd>{paid ? dollars(s.ai_limit_units) : "$0.00"}</dd></div><div><dt>AI spent</dt><dd>{dollars(s.used_units)}</dd></div><div><dt>Reserved for requests</dt><dd>{dollars(s.reserved_units)}</dd></div><div><dt>Available AI allowance</dt><dd>{paid ? dollars(s.remaining_units) : "$0.00 — available after payment"}</dd></div><div><dt>{s.cancel_at ? "Access ends" : "Paid through / renewal"}</dt><dd>{s.paid_until ? new Date(s.paid_until).toLocaleDateString("en-US", { timeZone: "UTC" }) : "After payment confirmation"}</dd></div></dl>
      <p>All AI work, including document processing and Help AI, shares this allowance. No rollover, top-ups, or automatic overages. If the allowance is exhausted, your other Sales tools remain available until the paid period ends.</p>
      {s.access_override_until && <p role="status">Platform Admin access override through {new Date(s.access_override_until).toLocaleDateString("en-US", { timeZone: "UTC" })}.</p>}
      <div className="rv-billing-actions">{(!s.stripe_subscription_id || ["canceled", "incomplete_expired"].includes(s.status)) && <form action={startSoloCheckout}><button className="btn btn-primary">Subscribe — $25/month</button></form>}{s.stripe_customer_id && <form action={manageSoloSubscription}><button className="btn">Manage subscription</button></form>}<Link className="btn" href="/admin/settings">My account</Link>{paid && <Link className="btn" href="/assistant">Open Sales AI</Link>}</div>
      {paid && <details><summary>Need the full platform?</summary><p>RunFloor Complete is $99/month per location. A Platform Admin must first set up your location. Access expands only after the upgrade payment is confirmed.</p><form action={upgradeSolo}><button className="btn">Request upgrade to Complete</button></form></details>}
    </section></div></AppShell>;
}
