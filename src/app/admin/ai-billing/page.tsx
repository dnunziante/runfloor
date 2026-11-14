import { getViewer } from "@/lib/auth/viewer";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { creditLabel } from "@/lib/ai-billing/money";
import { BillingAdminForm } from "./billing-admin-form";
import "../../ai-usage/usage.css";
export const dynamic = "force-dynamic";
export default async function AdminAiBilling({
  searchParams,
}: {
  searchParams: Promise<{
    organization?: string;
    message?: string;
    page?: string;
  }>;
}) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "platform_owner") redirect("/no-access");
  const query = await searchParams;
  const shell = (content: React.ReactNode) => (
    <AppShell title="Admin · AI Billing">
      <PageHeader
        title="AI billing administration"
        description="Platform-only allowances, costs, pricing approvals, purchases and audited adjustments."
      />
      {content}
    </AppShell>
  );
  if (viewer.demo)
    return shell(
      <section className="card">
        <h2>Live accounting is unavailable in demo mode</h2>
        <p>No invented balances or provider costs are displayed.</p>
      </section>,
    );
  const db = createAdminClient(),
    page = Math.max(1, Math.min(10000, Math.floor(Number(query.page) || 1))),
    org = /^[0-9a-f-]{36}$/i.test(query.organization ?? "")
      ? query.organization!
      : null;
  let usageQuery = db
    .from("ai_usage_requests")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (org) usageQuery = usageQuery.eq("organization_id", org);
  const [
    { data: usage, error, count },
    { data: packs },
    { data: rates },
    { data: companies },
    { data: orders },
    { data: audit },
    { data: settings },
  ] = await Promise.all([
    usageQuery.range((page - 1) * 50, page * 50 - 1),
    db
      .from("ai_credit_packs")
      .select("*")
      .order("created_at", { ascending: false }),
    db
      .from("ai_model_rates")
      .select("*")
      .order("created_at", { ascending: false }),
    db.from("organizations").select("id,name").order("name"),
    db
      .from("ai_credit_orders")
      .select(
        "id,organization_id,status,credit_units,price_cents,refunded_cents",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("ai_billing_audit")
      .select("id,action,reason,created_at,organization_id")
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("ai_billing_settings").select("*"),
  ]);
  if (error)
    return shell(
      <section className="card error-card" role="alert">
        <h2>Billing schema is not available</h2>
        <p>
          Apply the reviewed RunFloor migration to the selected environment
          before enabling AI metering or payments.
        </p>
      </section>,
    );
  return shell(
    <div className="ai-billing-grid">
      {query.message && (
        <p role="status" className="callout">
          {query.message}
        </p>
      )}
      <section className="card">
        <h2>RunFloor plan</h2>
        <p>
          $99/month · one location · unlimited users · 2,000 monthly AI credits.
          No annual plan or trial is configured. Pack prices and expiration
          policies stay inactive until separately approved.
        </p>
        <Link href="/ai-usage">Customer usage page</Link>
      </section>
      <section className="card">
        <h2>Company allowances</h2>
        <ul>
          {settings?.map((s) => (
            <li key={s.organization_id}>
              {companies?.find((c) => c.id === s.organization_id)?.name ??
                s.organization_id}
              : {creditLabel(Number(s.included_units))} monthly credits · reset
              day {s.reset_day} · {s.frozen ? "AI paused" : "AI enabled"}
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>Audited controls</h2>
        <p>
          Use the form below to create drafts or make deliberate configuration
          changes. Approval actions activate the specified price or policy; do
          not use them before business approval.
        </p>
        <BillingAdminForm companies={companies ?? []} />
      </section>
      <section className="card">
        <h2>Model rate versions</h2>
        <div className="credit-table-scroll">
          <table className="credit-table">
            <thead>
              <tr>
                <th>Model / version</th>
                <th>Input / cached / output units per million</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {rates?.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.model} · {r.version}
                  </td>
                  <td>
                    {r.input_units_per_million} / {r.cached_units_per_million} /{" "}
                    {r.output_units_per_million}
                  </td>
                  <td>{String(r.active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Credit packs</h2>
        <ul>
          {packs?.map((p) => (
            <li key={p.id}>
              {p.name} · {creditLabel(Number(p.credit_units))} credits · $
              {(p.price_cents / 100).toFixed(2)} ·{" "}
              {p.active ? "Active" : "Inactive draft"} ·{" "}
              {p.expires_days ? `${p.expires_days} days` : "No expiration"} · ID{" "}
              {p.id}
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>Actual provider costs and customer charges</h2>
        <form>
          <label>
            Company
            <select name="organization" defaultValue={org ?? ""}>
              <option value="">All companies</option>
              {companies?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-ghost">Filter</button>
        </form>
        <div className="credit-table-scroll">
          <table className="credit-table">
            <thead>
              <tr>
                <th>Company / employee</th>
                <th>Feature / model</th>
                <th>State</th>
                <th>Provider cost</th>
                <th>Credits charged</th>
                <th>Request</th>
              </tr>
            </thead>
            <tbody>
              {usage?.map((r) => (
                <tr key={r.id}>
                  <td>
                    {companies?.find((c) => c.id === r.organization_id)?.name ??
                      r.organization_id}
                    <br />
                    {r.user_id}
                  </td>
                  <td>
                    {r.operation}
                    <br />
                    {r.model}
                  </td>
                  <td>{r.state}</td>
                  <td>
                    ${(Number(r.provider_cost_units) / 100000000).toFixed(6)}
                  </td>
                  <td>{creditLabel(Number(r.charged_units))}</td>
                  <td>{r.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav className="credit-pagination">
          {page > 1 && (
            <Link href={`?page=${page - 1}&organization=${org ?? ""}`}>
              Previous
            </Link>
          )}
          <span>
            {count ?? 0} requests · page {page}
          </span>
          {page * 50 < (count ?? 0) && (
            <Link href={`?page=${page + 1}&organization=${org ?? ""}`}>
              Next
            </Link>
          )}
        </nav>
      </section>
      <section className="card">
        <h2>Recent purchases</h2>
        <ul>
          {orders?.map((o) => (
            <li key={o.id}>
              {o.organization_id} · {o.status} ·{" "}
              {creditLabel(Number(o.credit_units))} credits · $
              {(o.price_cents / 100).toFixed(2)} paid / $
              {(o.refunded_cents / 100).toFixed(2)} refunded
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>Recent audit history</h2>
        <ul>
          {audit?.map((a) => (
            <li key={a.id}>
              {a.created_at} · {a.action} · {a.reason}
            </li>
          ))}
        </ul>
      </section>
    </div>,
  );
}
