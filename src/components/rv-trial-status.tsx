import Link from "next/link";
import type { Viewer } from "@/lib/auth/viewer";
import { canManageBilling, selectedBilling } from "@/lib/billing/data";
import { availableCredits, billingAccess, trialDaysRemaining, trialMessages, trialMilestone } from "@/lib/billing/policy";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveOnboarding } from "@/app/billing/actions";
import "./rv-billing.css";

export async function RvTrialStatus({ viewer }: { viewer: Viewer }) {
  const row = await selectedBilling(viewer);
  if (!row || row.status !== "trialing") return null;
  const active = billingAccess(row);
  const db = await createClient();
  const { data: progress } = await db.from("rv_onboarding_progress").select("dismissed").eq("location_id",row.location_id).eq("user_id",viewer.id).maybeSingle();
  const milestone = trialMilestone(row);
  let reminder = null;
  if (milestone) {
    const shown = await createAdminClient().from("rv_trial_reminders").upsert({ location_id: row.location_id, user_id: viewer.id, milestone }, { onConflict: "location_id,user_id,milestone", ignoreDuplicates: true }).select("milestone");
    if (shown.data?.length) reminder = trialMessages[milestone];
  }
  return <><aside className="rv-trial-status" aria-label="Free trial status"><div><strong>{active ? `Your Free Trial — ${trialDaysRemaining(row)} Days Remaining` : "Your RunFloor Free Trial Has Ended."}</strong><p>{availableCredits(row)} of 100 AI Credits Remaining · Ends {new Date(row.trial_ends_at).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>{reminder && <p role="status"><strong>{reminder.title}</strong><br/>{reminder.body}</p>}{active && row.included_credits === 0 && <p>You&apos;ve used your 100 free AI credits. Upgrade to RunFloor Complete to unlock 2,000 AI credits every month and keep your entire team moving.</p>}</div>{canManageBilling(viewer) ? <Link className="btn btn-primary" href="/billing">Upgrade to RunFloor Complete</Link> : <p>Ask your dealership administrator about upgrading.</p>}</aside>{active && !progress?.dismissed && <section className="rv-billing-card"><h2>Make yourself at home.</h2><p>Complete your dealership profile, explore the Sales Assistant and product knowledge, invite your team, and try an operational checklist.</p><div className="rv-billing-actions"><Link className="btn" href="/billing?onboarding=show">Open getting-started checklist</Link><form action={saveOnboarding}><input type="hidden" name="locationId" value={row.location_id}/><button className="btn btn-ghost" name="dismissed" value="true">Skip for now</button></form></div></section>}</>;
}
