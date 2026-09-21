import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3, CalendarDays, CheckCircle2, FileText, Scale, Settings2, Target, TrendingUp, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReportingPeriodSelector } from "@/components/reporting-period-selector";
import { getMonthlyLeadershipReview } from "@/lib/executive/monthly-review-repository";
import { MonthlyReviewControls } from "@/components/monthly-review-controls";
import { MonthlyReviewResults } from "@/components/monthly-review-results";
import styles from "./review.module.css";

const periodName = (period: string) => new Date(`${period}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
const metricIcons = [TrendingUp, UserRound, BarChart3, Settings2];

export default async function MonthlyLeadershipReviewPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const data = await getMonthlyLeadershipReview(period);
  if (!data.canView) redirect("/dashboard");
  const { workspace, accountability, decisionLog } = data;
  const outcomes = decisionLog.decisions.filter((decision) => decision.measuredOutcome.trim()).map((decision) => decision.measuredOutcome);
  return <AppShell title="Monthly Leadership Review" industry="rv"><div className={styles.page}>
    <header className={styles.hero}><div className={styles.heroCopy}><span>Executive Advisor</span><h1>{periodName(data.reportingPeriod)}<br/><em>Leadership Review</em></h1><p>Turn performance into progress. Review results, align on priorities, and capture decisions — all in one place.</p></div><div className={styles.heroAside}><blockquote>“Great leaders turn<br/>results into action.”</blockquote><div className={styles.periodBox}><strong>Reporting period</strong><ReportingPeriodSelector action="/executive/review" periods={data.availablePeriods} selected={data.reportingPeriod}/><Link href={`/executive?period=${data.reportingPeriod}`}>Command Center <ArrowRight size={14}/></Link></div></div></header>
    {data.error && <p className="form-error executive-data-error"><AlertTriangle size={15}/>Some source data could not be loaded: {data.error}</p>}
    <section className={styles.metrics} aria-label="Monthly business snapshot">{workspace.metrics.map((metric, index) => { const Icon = metricIcons[index] ?? BarChart3; const value = metric.value === "—" ? "—" : metric.value; const percent = value.endsWith("%") ? Number.parseFloat(value) : 0; return <article key={metric.label}><div className={styles.metricTop}><span className={`${styles.metricIcon} ${styles[`tone${index}`]}`}><Icon size={27}/></span><div><h2>{metric.label}</h2><strong>{value}</strong></div></div><div className={styles.progress}><span style={{width:`${Math.max(0,Math.min(100,Number.isFinite(percent)?percent:0))}%`}}/></div><div className={`${styles.metricContext} ${styles[`context${metric.tone}`]}`}>{metric.context}</div></article>; })}</section>
    <section className={styles.middle}>
      <article className={styles.panel}><div className={styles.panelHead}><span className={styles.panelIcon}><CalendarDays size={24}/></span><div><h2>Meeting Agenda <small>{data.agenda.length} item{data.agenda.length === 1 ? "" : "s"}</small></h2><p>Items requiring leadership attention</p></div><Link href={`/executive?period=${data.reportingPeriod}`}>Review priorities <ArrowRight size={16}/></Link></div>{data.agenda.length ? <ol className={styles.agenda}>{data.agenda.map((item) => <li key={item.title}><div><strong>{item.title}</strong><p>{item.explanation}</p></div><Link href={`${item.href}?period=${data.reportingPeriod}`}>Review <ArrowRight size={16}/></Link></li>)}</ol> : <div className={styles.emptyCompact}><CheckCircle2 size={32}/><strong>No exceptions to review</strong><p>No current records created a leadership agenda item for this period.</p></div>}</article>
      <aside className={styles.panel}><div className={styles.panelHead}><span className={styles.panelIcon}><Target size={24}/></span><div><h2>Accountability</h2></div><Link href={`/executive/accountability?period=${data.reportingPeriod}`}>View all <ArrowRight size={16}/></Link></div><div className={styles.accountability}><span><strong>{accountability.summary.active}</strong><small>Active</small></span><span><strong>{accountability.summary.overdue}</strong><small>Overdue</small></span><span><strong>{accountability.summary.unassigned}</strong><small>Unassigned</small></span><span><strong>{accountability.summary.completionRate}%</strong><small>Completed</small></span></div></aside>
    </section>
    <section className={styles.lower}>
      <article className={styles.panel}><div className={styles.panelHead}><span className={styles.panelIcon}><FileText size={24}/></span><div><h2>Decisions &amp; Outcomes</h2><p>Track key decisions and their impact.</p></div></div>{decisionLog.decisions.length ? <div className={styles.decisions}>{decisionLog.decisions.map((decision) => <div key={decision.id}><span className={`badge ${decision.status === "open" ? "amber" : "blue"}`}>{decision.status}</span><strong>{decision.title}</strong><p>{decision.decision}</p><small>{decision.measuredOutcome || `Expected: ${decision.expectedOutcome}`}</small></div>)}</div> : <div className={styles.emptyDetail}><Scale size={52}/><strong>No decisions recorded yet</strong><p>Capture decisions from this review to keep your team aligned and accountable.</p></div>}<Link className={styles.addButton} href={`/executive/decisions?period=${data.reportingPeriod}`}>Open decision log <ArrowRight size={16}/></Link></article>
      <MonthlyReviewControls key={data.reportingPeriod} period={data.reportingPeriod} initial={data.completion} />
      <article className={styles.panel}><div className={styles.panelHead}><span className={styles.panelIcon}><TrendingUp size={24}/></span><div><h2>Verified Results</h2><p>Measured outcomes and progress.</p></div></div><MonthlyReviewResults wins={workspace.wins} risks={workspace.risks.map((risk) => `${risk.title} — ${risk.owner}`)} outcomes={outcomes}/><Link className={styles.outlineButton} href={`/executive/decisions?period=${data.reportingPeriod}`}>View decisions &amp; outcomes <ArrowRight size={16}/></Link></article>
    </section>
  </div></AppShell>;
}
