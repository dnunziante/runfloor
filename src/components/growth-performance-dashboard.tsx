"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, Check, CheckCircle2, Clock3, Lightbulb, LoaderCircle, Plus, Target, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import type { GrowthPlan } from "@/lib/growth/data";
import { calculateGrowthPerformance } from "@/lib/growth/performance";
import { formatGrowthDate, readGrowthPlans } from "@/lib/growth/storage";
import art from "@/app/growth/plans/plans.module.css";
import styles from "@/app/growth/performance/performance.module.css";

export function GrowthPerformanceDashboard({ initialPlans, persistence, initialError = "" }: { initialPlans: GrowthPlan[]; persistence: "demo" | "supabase"; initialError?: string }) {
  const [plans, setPlans] = useState<GrowthPlan[] | null>(persistence === "supabase" ? initialPlans : null);
  const [error, setError] = useState(initialError);
  useEffect(() => { if (persistence === "supabase") return; const timer = window.setTimeout(() => { try { setPlans(readGrowthPlans()); } catch { setError("Growth performance could not be loaded from this browser."); } }, 0); return () => window.clearTimeout(timer); }, [persistence]);

  const performance = calculateGrowthPerformance(plans ?? []);
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + (6 - today.getDay()));
  weekEnd.setHours(23, 59, 59, 999);
  const dueThisWeek = (plans ?? []).filter((plan) => { const date = new Date(`${plan.targetDate}T12:00:00`); return plan.status !== "Complete" && date >= new Date(today.toDateString()) && date <= weekEnd; }).length;
  const pipeline = [["Not started", performance.notStartedPlans], ["In progress", performance.inProgressPlans], ["Complete", performance.completedPlans]] as const;

  return <div className={styles.body}>
    <section className={styles.metrics} aria-label="Growth performance summary">
      <div className={styles.metric}><Target aria-hidden="true" /><span><strong>{performance.activePlans}</strong><b>Active action plans</b><small>{performance.activePlans ? "Plans to monitor." : "Create a plan to start tracking."}</small></span></div>
      <div className={styles.metric}><CheckCircle2 aria-hidden="true" /><span><strong>{performance.onTrackPlans}</strong><b>On track</b><small>Active without overdue dates.</small></span></div>
      <div className={styles.metric}><Clock3 aria-hidden="true" /><span><strong>{dueThisWeek}</strong><b>Due this week</b><small>Keep momentum going.</small></span></div>
      <div className={styles.metric}><BarChart3 aria-hidden="true" /><span><strong>{performance.completedPlans}</strong><b>Completed</b><small>Turn plans into real results.</small></span></div>
    </section>

    {error ? <section className={styles.state} role="alert"><h2>Performance unavailable</h2><p>{error}</p></section>
      : plans === null ? <section className={styles.state} aria-live="polite"><LoaderCircle className="spin" aria-hidden="true" /><h2>Loading performance</h2><p>Reviewing saved plans and task progress.</p></section>
      : plans.length === 0 ? <section className={styles.empty} aria-labelledby="empty-performance-title">
        <div className={styles.illustration}><div className={art.emptyArt} aria-hidden="true"><span className={art.artSun}/><span className={art.artMountain}/><span className={art.artRoad}/><span className={art.artRv}>▰<small>RV</small></span><span className={art.artSign}><b>PLAN</b><b>EXECUTE</b><b>TRACK</b><b>GROW</b></span></div></div>
        <div className={styles.emptyCopy}><h2 id="empty-performance-title">No performance data yet</h2><p>Create an action plan to begin tracking ownership, deadlines, and execution. Once plans are in motion, you’ll see progress and verified results here.</p><div className={styles.emptyActions}><Link className={styles.primaryLink} href="/growth#opportunity-board"><Plus size={20} aria-hidden="true" />Explore opportunities</Link><a className={styles.secondaryLink} href="#how-performance-works"><BookOpen size={20} aria-hidden="true" />Learn how it works</a></div></div>
        <div className={styles.emptyQuote}>“Plans turn<br />possibilities<br />into progress.”<small>— RunFloor</small></div>
      </section>
      : <>
        <section className={styles.detailGrid} aria-label="Plan and results overview">
          <div className={styles.detailCard}><div className={styles.detailHeading}><div><h2>Plan pipeline</h2><p>Where current growth work stands.</p></div><BarChart3 aria-hidden="true" /></div><div className={styles.pipeline}>{pipeline.map(([label, count]) => { const percent = Math.round(count / performance.totalPlans * 100); return <div key={label}><span><strong>{label}</strong><small>{count} {count === 1 ? "plan" : "plans"}</small></span><div className={styles.progress}><span style={{ width: `${percent}%` }}/></div><b>{percent}%</b></div>; })}</div><div className={styles.taskSummary}><strong>{performance.taskCompletion}%</strong> task completion · {performance.completedTasks} of {performance.totalTasks} steps <span>{performance.overduePlans} overdue</span></div></div>
          <div className={styles.detailCard}><div className={styles.detailHeading}><div><h2>Verified business results</h2><p>Actual outcomes entered against growth plans.</p></div><Target aria-hidden="true" /></div>{performance.outcomeEntries ? <div className={styles.results}>{[["Leads", performance.leads], ["Appointments", performance.appointments], ["Revenue", `$${performance.revenue.toLocaleString()}`], ["Cost", `$${performance.cost.toLocaleString()}`], ["ROI", performance.roi === null ? "Not available" : `${performance.roi}%`], ["Entries", performance.outcomeEntries]].map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}</div> : <div className={styles.noResults}><strong>No verified outcomes recorded</strong><p>Open an action plan to enter actual leads, appointments, revenue, costs, and verification notes. Task completion does not imply business results.</p></div>}</div>
        </section>
        <section className={styles.planSection} aria-labelledby="plan-progress-title"><div className={styles.planHeading}><div><h2 id="plan-progress-title">Progress by opportunity</h2><p>Execution health across every saved action plan.</p></div><Link href="/growth/plans">View all plans <ArrowRight size={16}/></Link></div><div className={styles.planList}>{performance.planPerformance.map(({ plan, completedTasks, totalTasks, progress, overdue }) => <article key={plan.id}><div className={styles.planName}><span className={overdue ? styles.overdue : ""}>{overdue ? "Overdue" : plan.status}</span><h3>{plan.title}</h3><p>{plan.owner} · Target {formatGrowthDate(plan.targetDate)}</p></div><div className={styles.measure}><small>Success measure</small><strong>{plan.targetMeasure || "Not defined"}</strong></div><div className={styles.planProgress}><strong>{progress}%</strong><small>{completedTasks} of {totalTasks} steps</small><div className={styles.progress}><span style={{ width: `${progress}%` }}/></div></div><Link href={`/growth/opportunities/${plan.opportunitySlug}`}>Open plan <ArrowRight size={16}/></Link></article>)}</div></section>
      </>}

    <div className={styles.exploreGrid}>
      <section className={styles.tip}><Lightbulb aria-hidden="true" /><div><h2>Pro tip</h2><p>Assign owners and target dates to keep plans moving and your team aligned.</p><small>— RunFloor</small></div></section>
      <section className={styles.learn}><BarChart3 aria-hidden="true" /><div><h2>What you’ll see here</h2><ul><li>Plan status and ownership</li><li>Upcoming and overdue deadlines</li><li>Key milestones and task completion</li><li>Verified business outcomes</li></ul></div></section>
      <section className={styles.start}><Trophy aria-hidden="true" /><div><h2>Ready to get started?</h2><p>Explore growth opportunities and create your first action plan.</p><Link href="/growth#opportunity-board"><Target size={20} aria-hidden="true" />Browse opportunities</Link></div></section>
    </div>
    <section className={styles.how} id="how-performance-works"><h2>How performance is measured</h2><p>Plan status, deadlines, and task completion come from saved action plans. Business results appear only after actual outcomes are recorded on a plan. {persistence === "demo" ? "Demo metrics use plans saved in this browser." : "Metrics use plans in your organization workspace."}</p><Link href="/growth/plans"><Check size={16} aria-hidden="true" />View action plans <ArrowRight size={15}/></Link></section>
  </div>;
}
