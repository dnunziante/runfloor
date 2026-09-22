import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, CalendarDays, Check, CheckCircle2, Circle, ClipboardCheck, Flag, Info, ListChecks, Target, TrendingUp } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ReportingPeriodSelector } from "@/components/reporting-period-selector";
import { canManageExecutiveTargets } from "@/lib/auth/permissions";
import { getViewer } from "@/lib/auth/viewer";
import { getExecutiveReadiness } from "@/lib/executive/readiness-repository";
import { buildExecutiveSetupSequence } from "@/lib/executive/setup-sequence";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import styles from "./rv-setup.module.css";

export default async function ExecutiveSetupPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const [{ period }, viewer] = await Promise.all([searchParams, getViewer()]);
  if (!viewer || !canManageExecutiveTargets(viewer.role)) redirect("/executive/readiness");
  const data = await getExecutiveReadiness(period);
  const steps = buildExecutiveSetupSequence(data.checks);
  const current = steps.find((step) => step.state === "current");
  const complete = steps.filter((step) => step.state === "complete").length;
  const templateKey = await getViewerIndustryTemplateKey(viewer);
  const workspaceName = viewer.organizationName.trim().toLowerCase();
  if (templateKey === "rv" || workspaceName === "runfloor demo" || workspaceName === "rayne rv") {
    return <AppShell title="Executive Setup Guide" industry="rv"><RvSetupGuide data={data} steps={steps} complete={complete}/></AppShell>;
  }
  return <AppShell title="Executive Setup Guide">
    <PageHeader eyebrow="Administrator setup" title="Prepare dependable Executive reporting step by step" description="Complete the required tenant configuration in order, then return here to confirm that every source is ready." action={<Link className="btn btn-secondary" href={`/executive/readiness?period=${data.reportingPeriod}`}><ListChecks size={16}/> View readiness</Link>}/>
    <div className="callout executive-disclaimer"><Info size={20}/><div><strong>{data.persistence === "supabase" ? "Live tenant setup" : "Guided demo setup"}</strong><p>Each completed step is verified from existing records. The guide does not mark a step complete based only on a button click.</p></div></div>
    {data.error && <p className="form-error executive-data-error"><AlertTriangle size={15}/>Some setup checks could not be completed: {data.error}</p>}
    <ReportingPeriodSelector action="/admin/executive/setup" periods={data.availablePeriods} selected={data.reportingPeriod}/>
    <section className="card setup-progress"><div><span className="badge blue">Foundation progress</span><h2>{complete} of {steps.length} required steps complete</h2><p>{current ? `Start with: ${current.title}` : "All required reporting sources are ready for this period."}</p></div><div className="setup-progress-ring" style={{ "--setup-progress": `${data.score * 3.6}deg` } as React.CSSProperties}><span>{data.score}%</span></div></section>
    {current ? <section className="card setup-current"><span className="badge amber">Start here</span><h2>{current.title}</h2><p>{current.explanation}</p><div className="callout"><AlertTriangle size={18}/><div><strong>What to do</strong><p>{current.action}</p></div></div><Link className="btn btn-primary" href={`${current.href}?period=${data.reportingPeriod}`}>Open this setup step <ArrowRight size={16}/></Link></section> : <section className="card setup-complete"><CheckCircle2 size={34}/><div><span className="badge blue">Foundation ready</span><h2>Required Executive sources are complete</h2><p>Continue maintaining monthly approvals and complete each leadership review to preserve reporting reliability.</p></div><Link className="btn btn-primary" href={`/executive/review?period=${data.reportingPeriod}`}>Open monthly review <ArrowRight size={16}/></Link></section>}
    <section className="card setup-sequence"><div className="section-heading"><div><span className="badge blue">Required sequence</span><h2>Executive reporting foundation</h2><p>Completed steps remain visible. The first incomplete step is highlighted as the current action.</p></div></div><ol>{steps.map((step) => <li className={step.state} key={step.id}><span className="setup-step-marker">{step.state === "complete" ? <Check size={17}/> : step.state === "current" ? step.number : <Circle size={13}/>}</span><div><div className="metric-row"><h3>{step.title}</h3><span className={`badge ${step.state === "complete" ? "blue" : step.state === "current" ? "amber" : ""}`}>{step.state === "complete" ? "Complete" : step.state === "current" ? "Current step" : "Upcoming"}</span></div><p>{step.explanation}</p>{step.state !== "complete" && <small>{step.action}</small>}</div><Link className="text-button" href={`${step.href}?period=${data.reportingPeriod}`}>{step.state === "complete" ? "Review" : "Open step"} <ArrowRight size={14}/></Link></li>)}</ol></section>
  </AppShell>;
}

function RvSetupGuide({ data, steps, complete }: { data: Awaited<ReturnType<typeof getExecutiveReadiness>>; steps: ReturnType<typeof buildExecutiveSetupSequence>; complete: number }) {
  const current = steps.find((step) => step.state === "current");
  const percent = steps.length ? Math.round(complete / steps.length * 100) : 100;
  const resources = [
    { icon: BookOpen, title: "Step-by-step guide", detail: "Review every required setup step", href: "#setup-steps" },
    { icon: ClipboardCheck, title: "Data requirements", detail: "See source readiness and coverage", href: `/executive/readiness?period=${data.reportingPeriod}` },
    { icon: Target, title: "Executive targets", detail: "Set reporting goals for this workspace", href: "/admin/executive" },
    { icon: Info, title: "Reporting help", detail: "Review data quality and missing sources", href: `/admin/sales-results/quality?period=${data.reportingPeriod}` },
  ];
  return <div className={styles.page}>
    <section className={styles.hero}><div className={styles.heroCopy}><span>Administrator setup</span><h1>Prepare dependable <br/>Executive reporting <br/><em>step by step.</em></h1><p>Complete the required tenant configuration in order, then confirm that every source is ready.</p></div><blockquote>“Great reporting<br/>starts with the<br/>right foundation.”<small>— RunFloor</small></blockquote><div className={styles.heroMotto}>Same Roads.<br/>Bigger Results.</div></section>
    <div className={styles.body}>
      {data.error && <p className={styles.error} role="alert"><AlertTriangle size={16}/>Some setup checks could not be completed: {data.error}</p>}
      <div className={styles.overview}><div className={`${styles.overviewCard} ${styles.period}`}><span className={styles.iconOrange}><CalendarDays/></span><ReportingPeriodSelector action="/admin/executive/setup" periods={data.availablePeriods} selected={data.reportingPeriod}/></div><div className={styles.overviewCard}><span className={styles.iconGreen}><Check size={28}/></span><div className={styles.progressText}><strong>{complete} of {steps.length}</strong><small>Steps complete</small><div className={styles.progressLine}><i style={{ width: `${percent}%` }}/></div></div><b>{percent}%</b></div><div className={styles.overviewCard}><span className={styles.iconRed}><Target/></span><div><strong>{current ? "Almost there!" : "Foundation ready"}</strong><small>{current ? "Complete setup to unlock Executive reporting and insights." : "Every required setup step is complete."}</small></div></div></div>
      <div className={styles.columns}><section id="setup-steps" className={styles.panel}><header><span className={styles.sectionIcon}><CalendarDays/></span><div><h2>Executive reporting foundation</h2><p>Complete these steps in order. Each step is verified using your existing records.</p></div></header><ol className={styles.steps}>{steps.map((step) => <li className={styles[step.state]} key={step.id}><span className={styles.marker}>{step.state === "complete" ? <Check size={18}/> : step.number}</span><span className={styles.stepIcon}><ClipboardCheck size={17}/></span><div className={styles.stepCopy}><strong>{step.title}</strong><p>{step.explanation}</p>{step.state === "current" && <small>{step.action}</small>}</div><span className={styles.status}>{step.state === "complete" ? "Complete" : step.state === "current" ? "Current step" : "Upcoming"}</span><Link className={styles.stepLink} href={`${step.href}?period=${data.reportingPeriod}`}>{step.state === "complete" ? "Review" : "Open step"}<ArrowRight size={15}/></Link></li>)}</ol></section><div className={styles.aside}><section className={styles.panel}><header><span className={styles.sectionIcon}><BookOpen/></span><div><h2>Setup resources</h2><p>Get the most out of your Executive reporting.</p></div></header><div className={styles.resources}>{resources.map(({ icon: Icon, title, detail, href }) => <Link href={href} key={title}><span><Icon size={18}/></span><div><strong>{title}</strong><small>{detail}</small></div><ArrowRight size={16}/></Link>)}</div></section><section className={`${styles.panel} ${styles.impact}`}><header><span className={styles.iconGreen}><TrendingUp/></span><div><h2>Your impact</h2><p>With Executive reporting, you can:</p></div></header><ul><li><Check/>Track real performance</li><li><Check/>Ensure accountability</li><li><Check/>Make faster, data-driven decisions</li><li><Check/>Drive growth across all locations</li></ul><blockquote>“Turn data<br/>into direction.”<small>— RunFloor</small></blockquote></section></div></div>
      <section className={styles.cta}><span><Flag/></span><div><h2>{current ? "Finish setup to unlock your Executive Command Center." : "Your Executive Command Center is ready."}</h2><p>Reliable data. Clear insights. Bigger opportunities.</p></div><Link href={current ? `${current.href}?period=${data.reportingPeriod}` : `/executive?period=${data.reportingPeriod}`}>{current ? "Continue setup" : "Open Command Center"}<ArrowRight/></Link></section>
    </div>
  </div>;
}
