import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { canManageBilling, getLocationBilling } from "@/lib/billing/data";
import { availableCredits, billingAccess, displayBillingStatus, trialDaysRemaining, trialMessages, trialMilestone } from "@/lib/billing/policy";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/app-shell";
import { addPaidLocation, openBillingPortal, saveOnboarding, selectBillingLocation, startCheckout } from "./actions";
import "@/components/rv-billing.css";

const date = (value: string | null) => value ? new Date(value).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "Not scheduled";
const steps = [["profile", "Complete dealership profile", "/admin/settings"], ["assistant", "Explore the AI Sales Assistant", "/assistant"], ["knowledge", "Review product knowledge", "/knowledge-base"], ["team", "Invite team members", "/admin/users"], ["operations", "Explore operations and checklists", "/operations/checklists"]];

export default async function Billing({ searchParams }: { searchParams: Promise<{ error?: string; checkout?: string; onboarding?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/billing");
  const params = await searchParams;
  const rows = await getLocationBilling(viewer);
  const db = viewer.demo ? null : await createClient();
  const locations = db ? await db.from("locations").select("id,name").eq("organization_id", viewer.organizationId) : { data: [] };
  const names = new Map((locations.data ?? []).map(row => [row.id, row.name]));
  const admin = canManageBilling(viewer);
  return <AppShell title="Subscription & Billing"><div className="rv-billing"><header><p className="lp-kicker">RUNFLOOR COMPLETE</p><h1>Your dealership. Moving forward.</h1><p>$99/month per location · Unlimited users · 2,000 monthly AI credits</p></header>{params.error && <p role="alert" className="rv-billing-alert">{params.error.slice(0,200)}</p>}{params.checkout && <p role="status">Your payment is being confirmed. Paid access and credits appear only after Stripe confirms payment. Refresh this page shortly.</p>}
    {!rows.length && <section className="rv-billing-card"><h2>{viewer.demo ? "You’re exploring the RunFloor demo." : "Your existing workspace is unchanged."}</h2><p>{viewer.demo ? "Start a free trial to create your own dealership." : "This workspace has not been enrolled in RunFloor RV location billing. Contact your platform administrator about migration; your current access and billing arrangements are preserved."}</p>{viewer.demo && <Link className="btn btn-primary" href="/signup">Start Your 7-Day Free Trial</Link>}</section>}
    {await Promise.all(rows.map(async row => {
      const active = billingAccess(row);
      const milestone = trialMilestone(row);
      let reminder: typeof trialMessages[keyof typeof trialMessages] | null = null;
      if (milestone && db) {
        const { data: shown } = await db.from("rv_trial_reminders").select("milestone").eq("location_id",row.location_id).eq("user_id",viewer.id).eq("milestone",milestone).maybeSingle();
        if (!shown) {
          const result = await createAdminClient().from("rv_trial_reminders").upsert({ location_id: row.location_id, user_id: viewer.id, milestone }, { onConflict: "location_id,user_id,milestone", ignoreDuplicates: true }).select("milestone");
          if (result.data?.length) reminder = trialMessages[milestone];
        }
      }
      const { data: progress } = db ? await db.from("rv_onboarding_progress").select("completed,dismissed").eq("location_id",row.location_id).eq("user_id",viewer.id).maybeSingle() : { data: null };
      return <section key={row.location_id} className="rv-billing-card">{admin && row.risk_review_required && <p role="alert" className="rv-billing-alert">A refund, dispute, or fraud warning requires administrator review in Stripe.</p>}<div className="rv-billing-heading"><h2>{names.get(row.location_id) || "Dealership location"}</h2><span className="badge">{displayBillingStatus(row)}</span></div>{reminder && <aside className="rv-billing-alert" role="status"><strong>{reminder.title}</strong><p>{reminder.body}</p></aside>}{!active && <><h3>Your RunFloor Free Trial Has Ended.</h3><p>Your dealership is ready to keep moving. Activate RunFloor Complete for $99/month per location and get unlimited users plus 2,000 monthly AI credits. Your dealership data is preserved.</p></>}
      <dl className="rv-billing-facts"><div><dt>Plan</dt><dd>RunFloor Complete</dd></div><div><dt>Price</dt><dd>$99/month per location</dd></div><div><dt>Users</dt><dd>Unlimited</dd></div><div><dt>{row.status === "trialing" ? "Trial AI credits remaining" : "Included credits remaining"}</dt><dd>{active ? row.included_credits : 0} / {row.status === "trialing" ? 100 : 2000}</dd></div><div><dt>Purchased credits</dt><dd>{row.purchased_credits}</dd></div><div><dt>Available credits</dt><dd>{availableCredits(row)}</dd></div><div><dt>{row.status === "trialing" ? `Trial ends (${trialDaysRemaining(row)} days remaining)` : "Paid through"}</dt><dd>{date(row.status === "trialing" ? row.trial_ends_at : row.period_end)}</dd></div><div><dt>Next billing date</dt><dd>{row.status === "trialing" || row.cancel_at || !active ? "No automatic charge scheduled" : date(row.period_end)}</dd></div></dl>
      <p className="rv-billing-note">Included monthly credits expire at the end of each paid billing period and do not roll over. Purchased credits remain separate and are used after included credits. No automatic overage charges.</p>
      {row.cancel_at && <p>Your subscription will remain active until {date(row.cancel_at)}. You will not be charged again unless you reactivate.</p>}
      <div className="rv-billing-actions">{admin ? <>{!row.stripe_subscription_id || ["canceled","expired"].includes(row.status) ? <form action={startCheckout}><input type="hidden" name="locationId" value={row.location_id}/><button className="btn btn-primary">{active ? "Upgrade to RunFloor Complete" : "Activate RunFloor — $99/Month"}</button></form> : null}{row.stripe_customer_id && <form action={openBillingPortal}><input type="hidden" name="locationId" value={row.location_id}/><button className="btn">Manage Billing</button></form>}</> : <p>Contact your dealership administrator to manage payments or upgrade.</p>}{active && <form action={selectBillingLocation}><input type="hidden" name="locationId" value={row.location_id}/><button className="btn">Use this location</button></form>}</div>
      {admin && <p className="rv-billing-note">Manage Billing opens Stripe’s secure portal for payment methods, invoices, cancellation, and eligible reactivation. Additional credit-pack purchasing is not configured yet.</p>}
      {active && (!progress?.dismissed || params.onboarding === "show") && <details open className="rv-onboarding"><summary>Getting started — your dealership checklist</summary><form action={saveOnboarding}><input type="hidden" name="locationId" value={row.location_id}/>{steps.filter(([key])=>admin || !["profile","team"].includes(key)).map(([key,label,href])=><label key={key}><input type="checkbox" name="completed" value={key} defaultChecked={progress?.completed?.includes(key)}/><Link href={href}>{label}</Link></label>)}<div className="rv-billing-actions"><button className="btn">Save progress</button><button className="btn btn-ghost" name="dismissed" value="true">Skip for now</button></div></form></details>}{progress?.dismissed && <Link href="/billing?onboarding=show">Return to onboarding checklist</Link>}</section>;
    }))}
    {admin && rows.length > 0 && <section className="rv-billing-card"><h2>Add a dealership location</h2><p>Each additional location requires its own $99/month subscription. Your organization and team accounts stay connected. The introductory trial is available once per organization.</p><form action={addPaidLocation} className="rv-billing-actions"><label>Location name <input name="locationName" minLength={2} maxLength={120} required/></label><button className="btn">Add location</button></form></section>}
    </div></AppShell>;
}
