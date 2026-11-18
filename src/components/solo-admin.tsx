import { createAdminClient } from "@/lib/supabase/admin";
import { getSoloSummary } from "@/lib/plans/data";
import { overrideSoloPlan } from "@/app/admin/ai-billing/solo-actions";
export async function SoloAdmin() {
  const { data, error } = await createAdminClient().from("account_subscription_plans").select("organization_id,organizations(name)");
  if (error) return <section className="card"><h2>Sales Solo administration</h2><p>Sales Solo schema is unavailable.</p></section>;
  return <section className="card"><h2>Sales Solo accounts</h2><p>Account-level plans and audited exceptions. Defaults: one user and $5 of actual AI provider cost per paid month.</p>{!data?.length && <p>No accounts are enrolled. Existing customer plans are unchanged.</p>}{await Promise.all((data || []).map(async row => {
    const s = await getSoloSummary(row.organization_id); if (!s) return null;
    const name = row.organizations as unknown as { name: string } | null;
    const dollars = (value: number) => `$${(value / 100000000).toFixed(4)}`;
    return <details key={row.organization_id}><summary>{name?.name || row.organization_id} · {s.plan_key} · {s.status} · {s.user_count}/{s.seat_limit} users</summary><p>Spent {dollars(s.used_units)} · Reserved {dollars(s.reserved_units)} · Remaining {dollars(s.remaining_units)} · Paid through {s.paid_until || "Not yet paid"}</p>{s.plan_key === "sales_solo" && <form action={overrideSoloPlan} className="form-stack"><input type="hidden" name="organizationId" value={row.organization_id}/><label>User limit<input className="input" name="seats" type="number" min={1} max={10000} defaultValue={s.seat_limit} required/></label><label>AI provider-cost limit (USD)<input className="input" name="cost" type="number" min={0} max={1000} step="0.01" defaultValue={s.ai_limit_units / 100000000} required/></label><label>Access exception until (UTC, optional)<input className="input" name="until" type="datetime-local" defaultValue={s.access_override_until?.slice(0,16) || ""}/></label><label>Reason<input className="input" name="reason" required minLength={8} maxLength={500}/></label><button className="btn btn-secondary">Save audited override</button></form>}</details>;
  }))}</section>;
}
