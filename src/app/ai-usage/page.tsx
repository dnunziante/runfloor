import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { creditLabel, validCreditSummary } from "@/lib/ai-billing/money";
import { purchaseCredits, openBillingPortal } from "./actions";
import "./usage.css";
export const dynamic = "force-dynamic";
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-US", { timeZone: "UTC" })
    : "Not configured";
export default async function AiUsage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const viewer = await getViewer();
  if (viewer && !viewer.demo && process.env.RUNFLOOR_RV_BILLING_ENABLED === "true") { const db = await createClient(); const { data } = await db.rpc("rv_access_state", { target_org: viewer.organizationId }); if (data?.managed) redirect("/billing"); }
  if (!viewer) redirect("/login");
  const filters = await searchParams;
  const shell = (content: React.ReactNode) => (
    <AppShell title="AI Usage & Billing">
      <PageHeader
        title="AI Usage & Billing"
        description="Your company’s shared AI allowance, purchased credits, and usage history."
      />
      {content}
    </AppShell>
  );
  if (viewer.demo)
    return shell(
      <section className="card">
        <h2>Sign in to view real usage</h2>
        <p>
          Demo mode has no billable AI balance. No sample credit totals are
          shown.
        </p>
      </section>,
    );
  const db = await createClient();
  const { data: summary, error } = await db.rpc("get_ai_credit_summary", {
    target_org: viewer.organizationId,
  });
  if (error || !validCreditSummary(summary))
    return shell(
      <section className="card error-card" role="alert">
        <h2>Usage is temporarily unavailable</h2>
        <p>Your balance could not be loaded. No estimated balance is shown.</p>
        <Link href="/ai-usage" className="btn btn-primary">
          Refresh usage
        </Link>
      </section>,
    );
  const canManage = summary.can_manage === true,
    page = Math.min(10000, Math.max(1, Math.floor(Number(filters.page) || 1))),
    size = 20;
  let history = db
    .from("ai_usage_requests")
    .select(
      "id,user_id,operation,model,state,reserved_units,charged_units,created_at",
      { count: "exact" },
    )
    .eq("organization_id", viewer.organizationId)
    .order("created_at", { ascending: false })
    .order("id");
  if (!canManage) history = history.eq("user_id", viewer.id);
  else if (/^[0-9a-f-]{36}$/i.test(filters.employee ?? ""))
    history = history.eq("user_id", filters.employee!);
  if (/^[a-zA-Z0-9_]{1,120}$/.test(filters.feature ?? ""))
    history = history.eq("operation", filters.feature!);
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(filters.from ?? "") &&
    !Number.isNaN(Date.parse(filters.from!))
  )
    history = history.gte("created_at", `${filters.from}T00:00:00Z`);
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(filters.to ?? "") &&
    !Number.isNaN(Date.parse(filters.to!))
  )
    history = history.lte("created_at", `${filters.to}T23:59:59.999Z`);
  const [
    { data: rows, count, error: historyError },
    { data: packs },
    { data: notices },
    { data: customer },
    { data: catalog },
    { data: members },
  ] = await Promise.all([
    history.range((page - 1) * size, page * size - 1),
    db
      .from("ai_credit_packs")
      .select("id,name,credit_units,price_cents,expires_days")
      .eq("active", true),
    db
      .from("ai_credit_notifications")
      .select("id,threshold,created_at")
      .eq("organization_id", viewer.organizationId)
      .gte("period_start", summary.period_start ?? new Date().toISOString())
      .order("threshold", { ascending: false }),
    canManage
      ? db
          .from("runfloor_billing_customers")
          .select("subscription_status")
          .eq("organization_id", viewer.organizationId)
          .maybeSingle()
      : { data: null },
    db
      .from("runfloor_billing_catalog")
      .select("active,monthly_price_cents")
      .eq("id", true)
      .maybeSingle(),
    canManage
      ? db
          .from("organization_memberships")
          .select("user_id")
          .eq("organization_id", viewer.organizationId)
          .eq("status", "active")
      : { data: [] },
  ]);
  const memberIds = (members ?? []).map((item) => item.user_id);
  const { data: names } = memberIds.length
    ? await db.from("profiles").select("id,full_name").in("id", memberIds)
    : { data: [] };
  const name = (id: string) =>
    id === viewer.id
      ? "You"
      : (names?.find((item) => item.id === id)?.full_name ?? "Team member");
  const total = Number(summary.included_units),
    used = Number(summary.used_units),
    available = Number(summary.available_units),
    percent = total ? Math.min(100, (used / total) * 100) : 100;
  const next = (value: number) => {
    const query = new URLSearchParams(
      Object.entries(filters).filter(
        (item): item is [string, string] => typeof item[1] === "string",
      ),
    );
    query.set("page", String(value));
    return `/ai-usage?${query}`;
  };
  return shell(
    <div className="ai-billing-grid">
      {filters.error && (
        <p role="alert" className="callout">
          {filters.error}
        </p>
      )}
      {filters.payment === "pending" && (
        <p role="status" className="callout">
          Payment is being verified. Your balance changes only after payment
          confirmation.
        </p>
      )}
      {summary.frozen && (
        <p role="alert" className="callout">
          AI is paused for account review. Your other RunFloor tools remain
          available.
        </p>
      )}
      {notices?.[0] && (
        <p role="status" className="callout">
          Your company has used at least {notices[0].threshold}% of this month’s
          included AI credits.
        </p>
      )}
      <section className="card">
        <h2>{viewer.organizationName} · shared AI credits</h2>
        <p>
          {date(summary.period_start)} – {date(summary.period_end)} (UTC)
        </p>
        <div className="credit-stats">
          <div>
            <b>{creditLabel(total)}</b>
            <span>Included this period</span>
          </div>
          <div>
            <b>{creditLabel(used)}</b>
            <span>Used included credits</span>
          </div>
          <div>
            <b>
              {creditLabel(
                Math.max(0, Number(summary.included_remaining_units)),
              )}
            </b>
            <span>Included remaining after reservations</span>
          </div>
          <div>
            <b>{creditLabel(Math.max(0, available))}</b>
            <span>Total available</span>
          </div>
          <div>
            <b>{creditLabel(Number(summary.reserved_units))}</b>
            <span>Reserved / pending</span>
          </div>
          <div>
            <b>{creditLabel(Number(summary.purchased_units))}</b>
            <span>Purchased / adjustments remaining</span>
          </div>
        </div>
        <progress
          aria-label="Included AI credit usage"
          max={100}
          value={percent}
        />
        <p>
          Monthly included credits reset on the period end date. Purchased
          credits carry forward unless a stated pack expiration applies.
          Included credits are used first.
        </p>
        {available <= 0 && (
          <p role="alert">
            AI credits are exhausted.{" "}
            {canManage
              ? "Purchase more below or wait for your monthly reset."
              : "Ask your billing administrator to purchase more."}
          </p>
        )}
      </section>
      {canManage && (
        <section className="card">
          <h2>Buy more credits</h2>
          {packs?.length ? (
            <div className="credit-pack-grid">
              {packs.map((pack) => (
                <form action={purchaseCredits} key={pack.id}>
                  <input
                    type="hidden"
                    name="request"
                    value={crypto.randomUUID()}
                  />
                  <input type="hidden" name="pack" value={pack.id} />
                  <h3>{pack.name}</h3>
                  <p>
                    {creditLabel(Number(pack.credit_units))} credits · $
                    {(pack.price_cents / 100).toFixed(2)}
                  </p>
                  <p>
                    {pack.expires_days
                      ? `Expires ${pack.expires_days} days after purchase`
                      : "Purchased credits do not expire"}
                  </p>
                  <button className="btn btn-primary">Buy more credits</button>
                </form>
              ))}
            </div>
          ) : (
            <p>
              Credit packs are not available for purchase yet. No retail prices
              have been activated.
            </p>
          )}
          <h3>RunFloor plan</h3>
          <p>
            $99/month · one location · unlimited users · 2,000 monthly AI
            credits.
          </p>
          <p>
            Subscription: {customer?.subscription_status ?? "Not subscribed"}
          </p>
          {catalog?.active &&
            (!customer?.subscription_status ||
              ["canceled", "incomplete_expired"].includes(
                customer.subscription_status,
              )) && (
              <form action={purchaseCredits}>
                <input type="hidden" name="kind" value="subscription" />
                <input
                  type="hidden"
                  name="request"
                  value={crypto.randomUUID()}
                />
                <button className="btn btn-primary">
                  Subscribe for $99/month
                </button>
              </form>
            )}
          {customer && (
            <form action={openBillingPortal}>
              <button className="btn btn-ghost">
                Manage subscription and payment method
              </button>
            </form>
          )}
        </section>
      )}
      <section className="card">
        <h2>{canManage ? "Company usage history" : "Your usage history"}</h2>
        <form method="get" className="credit-filters">
          <label>
            From
            <input type="date" name="from" defaultValue={filters.from} />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={filters.to} />
          </label>
          <label>
            Feature
            <input
              name="feature"
              maxLength={120}
              defaultValue={filters.feature}
              placeholder="e.g. createSalesEmail"
            />
          </label>
          {canManage && (
            <label>
              Employee
              <select name="employee" defaultValue={filters.employee ?? ""}>
                <option value="">All employees</option>
                {memberIds.map((id) => (
                  <option key={id} value={id}>
                    {name(id)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="btn btn-ghost">Filter</button>
        </form>
        {historyError ? (
          <p role="alert">Usage history could not be loaded.</p>
        ) : (
          <div className="credit-table-scroll">
            <table className="credit-table">
              <thead>
                <tr>
                  <th>Date (UTC)</th>
                  <th>Employee</th>
                  <th>Feature</th>
                  <th>Status</th>
                  <th>Credits charged</th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {new Date(row.created_at).toLocaleString("en-US", {
                        timeZone: "UTC",
                      })}
                    </td>
                    <td>{name(row.user_id)}</td>
                    <td>{row.operation}</td>
                    <td>{row.state}</td>
                    <td>{creditLabel(Number(row.charged_units))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows?.length && <p>No matching usage yet.</p>}
          </div>
        )}
        <nav aria-label="Usage history pages" className="credit-pagination">
          {page > 1 && <Link href={next(page - 1)}>Previous</Link>}
          <span>
            Page {page} · {count ?? 0} records
          </span>
          {page * size < (count ?? 0) && (
            <Link href={next(page + 1)}>Next</Link>
          )}
        </nav>
      </section>
    </div>,
  );
}
