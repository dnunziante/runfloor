"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, CalendarDays, Check, CheckCircle2, ClipboardList, Lightbulb, LoaderCircle, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { GrowthPlan } from "@/lib/growth/data";
import { formatGrowthDate, readGrowthPlans } from "@/lib/growth/storage";
import styles from "@/app/growth/plans/plans.module.css";

export function GrowthPlanList({ initialPlans, persistence, initialError = "" }: { initialPlans: GrowthPlan[]; persistence: "demo" | "supabase"; initialError?: string }) {
  const [plans, setPlans] = useState<GrowthPlan[] | null>(persistence === "supabase" ? initialPlans : null);
  const [error, setError] = useState(initialError);
  useEffect(() => { if (persistence === "supabase") return; const timer = window.setTimeout(() => { try { setPlans(readGrowthPlans()); } catch { setError("Saved plans could not be loaded from this browser."); } }, 0); return () => window.clearTimeout(timer); }, [persistence]);

  const currentPlans = plans ?? [];
  const active = currentPlans.filter((plan) => plan.status !== "Complete");
  const completed = currentPlans.length - active.length;
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + (6 - today.getDay()));
  weekEnd.setHours(23, 59, 59, 999);
  const dueThisWeek = active.filter((plan) => { const date = new Date(`${plan.targetDate}T12:00:00`); return date >= new Date(today.toDateString()) && date <= weekEnd; }).length;
  const opportunities = new Set(currentPlans.map((plan) => plan.opportunitySlug)).size;

  return <div className={styles.body}>
    <div className={styles.overview} aria-label="Action plan overview">
      <div className={styles.metric}><ClipboardList aria-hidden="true" /><span><strong>{active.length}</strong><b>Active plans</b><small>{active.length ? "Plans in progress" : "Get started by creating your first plan."}</small></span></div>
      <div className={styles.metric}><CalendarDays aria-hidden="true" /><span><strong>{dueThisWeek}</strong><b>Due this week</b><small>Stay on track with key dates.</small></span></div>
      <div className={styles.metric}><CheckCircle2 aria-hidden="true" /><span><strong>{completed}</strong><b>Completed</b><small>Turn action into results.</small></span></div>
      <div className={styles.metric}><BarChart3 aria-hidden="true" /><span><strong>{opportunities}</strong><b>Opportunities in plans</b><small>Build plans around top ideas.</small></span></div>
      <Link className={styles.createButton} href="/growth#opportunity-board"><Plus aria-hidden="true" />Create action plan</Link>
    </div>

    {error ? <section className={styles.state}><h2>Plans unavailable</h2><p>{error}</p><Link href="/growth">Explore opportunities <ArrowRight size={16}/></Link></section>
      : plans === null ? <section className={styles.state} aria-live="polite"><LoaderCircle className="spin" aria-hidden="true" /><h2>Loading action plans</h2><p>Checking this browser for saved prototype data.</p></section>
      : plans.length === 0 ? <section className={styles.empty} aria-labelledby="empty-plans-title">
        <div className={styles.emptyCopy}>
          <h2 id="empty-plans-title">No action plans yet.</h2>
          <p>Choose a growth opportunity and create the first validation plan.</p>
          <div className={styles.emptyActions}><Link className={styles.primaryLink} href="/growth#opportunity-board"><Plus size={20} aria-hidden="true" />Explore opportunities</Link><a className={styles.secondaryLink} href="#how-plans-work"><BookOpen size={20} aria-hidden="true" />Learn how it works</a></div>
          <ul><li>Set clear tasks and target dates</li><li>Track progress and keep your team aligned</li><li>Turn opportunities into real results</li></ul>
        </div>
        <div className={styles.emptyArt} aria-hidden="true"><span className={styles.artSun}/><span className={styles.artMountain}/><span className={styles.artRoad}/><span className={styles.artRv}>▰<small>RV</small></span><span className={styles.artSign}><b>PLAN</b><b>EXECUTE</b><b>TRACK</b><b>GROW</b></span><em>“A plan today.<br />A bigger tomorrow.”</em></div>
      </section>
      : <section className={styles.planSection} aria-labelledby="saved-plans-title"><div className={styles.planHeading}><h2 id="saved-plans-title">Your action plans</h2><p>Open a plan to update tasks, owners, and outcomes.</p></div><div className={styles.planGrid}>{plans.map((plan) => { const done = plan.tasks.filter((task) => task.complete).length; const progress = plan.tasks.length ? Math.round(done / plan.tasks.length * 100) : 0; return <article className={styles.planCard} key={plan.id}><div className={styles.planTop}><span>{plan.status}</span><strong>{progress}%</strong></div><h3>{plan.title}</h3><p>{plan.owner} · Target {formatGrowthDate(plan.targetDate)}</p><div className={styles.progress} role="progressbar" aria-label={`${plan.title} progress`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }}/></div><small><CheckCircle2 size={14}/>{done} of {plan.tasks.length} steps complete</small><Link href={`/growth/opportunities/${plan.opportunitySlug}`}>Open action plan <ArrowRight size={16}/></Link></article>; })}</div></section>}

    <div className={styles.exploreGrid}>
      <section className={styles.exploreIdeas}><Lightbulb aria-hidden="true" /><div><h2>Need ideas?</h2><p>Go back to your growth opportunities to find high-potential ideas.</p><Link href="/growth">View opportunities <ArrowRight size={17}/></Link></div></section>
      <section className={styles.exploreTeam}><Users aria-hidden="true" /><div><h2>Work together</h2><p>{persistence === "demo" ? "Prototype plans are saved in this browser." : "Plans are shared with authorized members of your organization."}</p><a href="#workspace-info">About this workspace <ArrowRight size={17}/></a></div></section>
      <section className={styles.exploreImpact}><BarChart3 aria-hidden="true" /><div><h2>Track your impact</h2><p>Measure progress and see how your efforts drive real dealership growth.</p><Link href="/growth/performance">View performance <ArrowRight size={17}/></Link></div></section>
    </div>
    <section className={styles.how} id="how-plans-work"><h2>How action plans work</h2><p>Choose an opportunity, assign an owner and target date, then complete validation steps. Record actual results on the plan to see verified performance.</p><div id="workspace-info"><Check size={17} aria-hidden="true" /><p>{persistence === "demo" ? "Prototype plans are saved only in this browser. Clearing browser data removes them." : "Plans are stored in your organization workspace and visible to authorized members."}</p></div></section>
  </div>;
}
