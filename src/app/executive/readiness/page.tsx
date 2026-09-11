import Link from "next/link";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, CircleGauge, Database, ListChecks, Settings, Target, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReportingPeriodSelector } from "@/components/reporting-period-selector";
import { getExecutiveReadiness } from "@/lib/executive/readiness-repository";

const checkIcons = [Building2, Database, Target, UsersRound, CircleGauge, ListChecks] as const;

export default async function ExecutiveReadinessPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const data = await getExecutiveReadiness(period);
  if (!data.canView) redirect("/dashboard");
  const required = data.checks.filter((check) => check.required);
  const practices = data.checks.filter((check) => !check.required);
  const attention = required.filter((check) => !check.ready);
  return <AppShell title="Executive Data Readiness"><div className="ready-command">
    <section className="ready-hero"><div><span>Executive advisor</span><h1>Know what must be completed<br/>before <em>trusting the report.</em></h1><p>A deterministic checklist of the tenant records required for dependable monthly leadership reporting.</p><div>{data.canManageSetup && <Link className="ready-primary" href={`/admin/executive/setup?period=${data.reportingPeriod}`}><Settings/>Guided setup</Link>}<Link className="ready-secondary" href="/executive"><ArrowRight/>Command center</Link></div></div><ReportingPeriodSelector action="/executive/readiness" periods={data.availablePeriods} selected={data.reportingPeriod}/></section>
    {data.error && <p className="form-error ready-error"><AlertTriangle/>Some readiness checks could not be completed: {data.error}</p>}
    <section className="ready-metrics" aria-label="Data readiness summary"><article className="ready-overall"><div className="ready-ring" style={{ "--ready-score": `${data.score}%` } as React.CSSProperties}><strong>{data.score}%</strong></div><span><b>Overall Readiness</b><small>{data.readyRequired} of {data.requiredTotal} checks ready</small></span></article><article><span className="ready-icon green"><Building2/></span><div><strong>{data.readyRequired}</strong><b>Ready Checks</b><small>Validated source areas</small></div></article><article><span className="ready-icon amber"><AlertTriangle/></span><div><strong>{attention.length}</strong><b>Needs Attention</b><small>Required checks incomplete</small></div></article><article><span className="ready-icon red"><Database/></span><div><strong>{data.missingOperations}</strong><b>Missing Operations Data</b><small>Locations without checklist coverage</small></div></article></section>
    <nav className="ready-tabs" aria-label="Readiness status summary"><a className="active" href="#required">All Checks ({required.length})</a><a href="#required">Ready ({data.readyRequired})</a><a href="#issues">Needs Attention ({attention.length})</a><a href="#practices">Reporting Practices ({practices.length})</a></nav>
    <ReadinessTable checks={required} period={data.reportingPeriod}/>
    <section className="ready-lower">
      <article className="ready-card" id="practices"><header><div><h2>Reporting Practices</h2><p>Supporting practices that strengthen comparison and accountability.</p></div></header><div className="ready-practice-list">{practices.map((check) => <Link href={`${check.href}${check.href.includes("?") ? "&" : "?"}period=${data.reportingPeriod}`} key={check.id}><span className={check.ready ? "ready" : "attention"}>{check.ready ? <CheckCircle2/> : <AlertTriangle/>}</span><div><strong>{check.title}</strong><small>{check.explanation}</small></div><ArrowRight/></Link>)}</div></article>
      <div className="ready-side"><article className="ready-card" id="issues"><header><h2>Top Issues to Resolve</h2></header>{attention.length ? <div className="ready-issue-list">{attention.map((check, index) => <Link href={`${check.href}${check.href.includes("?") ? "&" : "?"}period=${data.reportingPeriod}`} key={check.id}><b>{index + 1}</b><span><strong>{check.title}</strong><small>{check.action}</small></span><ArrowRight/></Link>)}</div> : <div className="ready-complete"><CheckCircle2/><strong>All required checks are ready</strong><p>This report has every required source area.</p></div>}</article>
        <article className="ready-card ready-method"><header><Settings/><h2>How Readiness is Calculated</h2></header><p>The percentage counts only required source checks:</p><ol>{required.map((check, index) => <li key={check.id}><span>{index + 1}</span>{check.title}</li>)}</ol><small>Reporting practices are shown separately and do not affect the readiness score.</small></article></div>
    </section>
    <section className="ready-cta"><Target/><div><h2>Get to 100% and unlock confident leadership reporting.</h2><p>Complete the required checks, assign ownership, and ensure all locations are ready.</p></div><Link href="/executive">Go to Command Center <ArrowRight/></Link></section>
  </div></AppShell>;
}

function ReadinessTable({ checks, period }: { checks: Awaited<ReturnType<typeof getExecutiveReadiness>>["checks"]; period: string }) {
  return <section className="ready-card ready-table-card" id="required"><div className="ready-table-wrap"><table><thead><tr><th>#</th><th>Required Source</th><th>Description</th><th>Status</th><th>Progress</th><th>Action</th></tr></thead><tbody>{checks.map((check, index) => { const Icon = checkIcons[index] ?? ListChecks; return <tr key={check.id}><td>{index + 1}</td><td><span className={check.ready ? "green" : "red"}><Icon/></span><strong>{check.title}</strong></td><td>{check.explanation}</td><td><b className={check.ready ? "status-ready" : "status-attention"}>{check.ready ? "Ready" : "Needs Attention"}</b></td><td><div className="ready-progress"><i style={{ width: check.ready ? "100%" : "18%" }}/></div><strong>{check.ready ? "100%" : "Incomplete"}</strong></td><td><Link className={check.ready ? "" : "action"} href={`${check.href}${check.href.includes("?") ? "&" : "?"}period=${period}`}>{check.ready ? "View" : "Resolve"}</Link></td></tr>; })}</tbody></table></div></section>;
}
