import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, BarChart3, Building2, CheckCircle2, ClipboardCheck, Crown, FileText, Gauge, ListChecks, Settings, Target, TrendingUp, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExecutiveLocationTools } from "@/components/executive-location-tools";
import { ExecutiveReviewBoard } from "@/components/executive-review-board";
import { ReportingPeriodSelector } from "@/components/reporting-period-selector";
import { getExecutiveWorkspace } from "@/lib/executive/repository";

const metricIcons = [TrendingUp, UsersRound, Target, Activity] as const;
const tabs = [["Overview", "/executive", Gauge],["Sales Performance", "/executive/trends", BarChart3],["People & Coaching", "/executive/accountability", UsersRound],["Operations", "/operations/performance", ListChecks],["Location Comparison", "#locations", Building2],["Priorities", "#priorities", Crown],["Reports", "/executive/review", FileText]] as const;

export default async function ExecutiveAdvisorPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const data = await getExecutiveWorkspace(period);
  if (!data.canView) redirect("/dashboard");
  const coaching = data.signals.find((signal) => signal.label.toLowerCase().includes("coaching"));
  return <AppShell title="Executive Advisor"><div className="exec-command">
    <section className="exec-hero"><div><span>Executive command center</span><h1>See what matters, understand why,<br/>and <em>decide what happens next.</em></h1><p>Bring sales, people, growth, and operations signals into one clear leadership view.</p></div><ReportingPeriodSelector action="/executive" periods={data.availablePeriods} selected={data.reportingPeriod} label="Reporting period"/></section>
    {data.error && <p className="form-error exec-error"><AlertTriangle/>Some source data could not be loaded: {data.error}</p>}
    <nav className="exec-tabs" aria-label="Executive command center sections">{tabs.map(([label, href, Icon], index) => <Link className={index === 0 ? "active" : ""} href={href === "/executive/review" ? `${href}?period=${data.reportingPeriod}` : href} key={label}><Icon/>{label}</Link>)}</nav>
    <section className="exec-metrics" aria-label="Executive summary">{data.metrics.map((metric, index) => { const Icon = metricIcons[index] ?? Gauge; return <article key={metric.label}><span className={`exec-metric-icon tone-${metric.tone}`}><Icon/></span><div><small>{metric.label}</small><strong>{metric.value}</strong><b className={metric.tone}>{metric.context}</b></div></article>; })}</section>
    <section className="exec-insights">
      <article className="exec-card exec-score"><header><h2>Performance Signals</h2><Link href="/executive/trends">View trends <ArrowRight/></Link></header>{data.signals.length ? <div className="exec-signal-chart">{data.signals.map((signal) => { const progress = Math.min(100, Math.round(signal.value / signal.target * 100)); return <Link href={signal.href} key={signal.label}><span><strong>{signal.label}</strong><small>{signal.value}{signal.unit} of {signal.target}{signal.unit}</small></span><div><i style={{ width: `${progress}%` }}/></div><b>{progress}%</b></Link>; })}</div> : <p className="exec-empty">No connected performance data for this period.</p>}</article>
      <article className="exec-card exec-coaching"><header><h2>Coaching Completion</h2></header><div className="exec-ring" style={{ "--completion": `${coaching ? Math.min(100, Math.round(coaching.value / coaching.target * 100)) : 0}%` } as React.CSSProperties}><strong>{coaching ? `${coaching.value}%` : "—"}</strong></div><p>{coaching ? `${coaching.value}${coaching.unit} of ${coaching.target}${coaching.unit} target` : "No connected coaching data"}</p><Link href="/executive/accountability">View details <ArrowRight/></Link></article>
      <article className="exec-card exec-alerts"><header><h2>Key Risks</h2></header>{data.risks.length ? <div>{data.risks.slice(0,3).map((risk) => <Link href={risk.href} key={risk.title}><AlertTriangle/><span><strong>{risk.title}</strong><small>{risk.owner} · {risk.due}</small></span></Link>)}</div> : <p className="exec-empty">No high-severity risks exceed the configured limit.</p>}<Link className="exec-outline-link" href="/operations/alerts">View all alerts <ArrowRight/></Link></article>
    </section>
    <ExecutiveLocationTools locations={data.locations} reportingPeriod={data.reportingPeriod}/>
    <section className="exec-bottom" id="priorities">
      <article className="exec-card"><header><h2>Top Priorities</h2><Link href={`/executive/review?period=${data.reportingPeriod}`}>View all <ArrowRight/></Link></header><ol className="exec-priority-list">{data.priorities.slice(0,5).map((priority) => <li key={priority.id}><span>{priority.rank}</span><Link href={priority.href}><strong>{priority.title}</strong><small>{priority.action}</small></Link><b className={priority.urgency === "Act now" ? "high" : priority.urgency === "This week" ? "medium" : "low"}>{priority.urgency}</b></li>)}</ol></article>
      <article className="exec-card"><header><h2>Key Risks</h2><Link href="/operations/alerts">View all <ArrowRight/></Link></header><div className="exec-risk-list">{data.risks.map((risk) => <Link href={risk.href} key={risk.title}><AlertTriangle/><span><strong>{risk.title}</strong><small>{risk.owner} · {risk.due}</small></span></Link>)}</div></article>
      <article className="exec-card"><header><h2>What&apos;s Working</h2><Link href="/executive/trends">View all <ArrowRight/></Link></header><ul className="exec-win-list">{data.wins.map((win) => <li key={win}><CheckCircle2/><span>{win}</span></li>)}</ul></article>
    </section>
    {data.canManageReviews && <details className="exec-review"><summary><ClipboardCheck/>Manage priority ownership and reviews</summary><ExecutiveReviewBoard period={data.reportingPeriod} persistence={data.persistence} priorities={data.priorities} reviews={data.reviews}/></details>}
    <footer className="exec-quote"><span>“Turn data into decisions. Decisions into action. Action into growth.”</span><b>People · Processes · Profit</b></footer>
    {data.canEditTargets && <div className="exec-admin-links"><Link href="/admin/sales-results/quality"><CheckCircle2/>Data quality</Link><Link href="/admin/executive"><Settings/>Configure targets</Link></div>}
  </div></AppShell>;
}
