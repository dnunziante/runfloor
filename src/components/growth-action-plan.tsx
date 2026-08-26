"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, DollarSign, LoaderCircle, Plus, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { createPersistentGrowthOutcome, createPersistentGrowthPlan, deletePersistentGrowthOutcome, togglePersistentGrowthTask } from "@/app/growth/actions";
import type { GrowthOpportunity, GrowthPlan } from "@/lib/growth/data";
import { formatGrowthDate, readGrowthPlans, writeGrowthPlans } from "@/lib/growth/storage";
import type { OrganizationLocation } from "@/lib/locations";

export function GrowthActionPlan({ opportunity, initialPlan, persistence, locations }: { opportunity: GrowthOpportunity; initialPlan: GrowthPlan | null; persistence: "demo" | "supabase"; locations: OrganizationLocation[] }) {
  const [ready, setReady] = useState(persistence === "supabase");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<GrowthPlan | null>(initialPlan);
  const [saving, setSaving] = useState(false);
  const [owner, setOwner] = useState("BGC Growth Team");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [targetDate, setTargetDate] = useState("");
  const [targetMeasure, setTargetMeasure] = useState(opportunity.measures[0] ?? "");
  const [outcomeDate, setOutcomeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [leads, setLeads] = useState("0");
  const [appointments, setAppointments] = useState("0");
  const [revenue, setRevenue] = useState("0");
  const [cost, setCost] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (persistence === "supabase") return;
    const timer = window.setTimeout(() => {
      try { setPlan(readGrowthPlans().find((item) => item.opportunitySlug === opportunity.slug) ?? null); }
      catch { setError("Saved plans could not be loaded in this browser."); }
      finally { setReady(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [opportunity.slug, persistence]);

  function save(next: GrowthPlan) {
    try {
      const plans = readGrowthPlans();
      writeGrowthPlans([...plans.filter((item) => item.opportunitySlug !== opportunity.slug), next]);
      setPlan(next); setError("");
    } catch { setError("This plan could not be saved in this browser."); }
  }

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetDate) { setError("Choose a target date before creating the plan."); return; }
    const locationName = locations.find((location) => location.id === locationId)?.name ?? "All locations";
    const next = { id: crypto.randomUUID(), opportunitySlug: opportunity.slug, title: opportunity.title, locationId: locationId || null, locationName, owner, targetDate, targetMeasure, status: "Not started" as const, tasks: opportunity.actions.map((title) => ({ title, complete: false })), outcomes: [], createdAt: new Date().toISOString() };
    if (persistence === "demo") { save(next); return; }
    setSaving(true); const result = await createPersistentGrowthPlan({ opportunitySlug: opportunity.slug, title: opportunity.title, locationId: locationId || null, locationName, owner, targetDate, targetMeasure, tasks: opportunity.actions }); setSaving(false);
    if (result.error) setError(result.error); else if (result.plan) { setPlan(result.plan); setError(""); }
  }

  async function toggleTask(index: number) {
    if (!plan) return;
    const tasks = plan.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, complete: !task.complete } : task);
    const completed = tasks.filter((task) => task.complete).length;
    const next = { ...plan, tasks, status: completed === tasks.length ? "Complete" as const : completed > 0 ? "In progress" as const : "Not started" as const };
    if (persistence === "demo") { save(next); return; }
    const task = tasks[index]; if (!task?.id) return;
    setPlan(next); const result = await togglePersistentGrowthTask(plan.id, task.id, task.complete); if (result.error) { setPlan(plan); setError(result.error); } else if (result.plan) setPlan(result.plan);
  }

  async function recordOutcome(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!plan) return;
    const values = { leads: Number(leads), appointments: Number(appointments), revenue: Number(revenue), cost: Number(cost) };
    if (!outcomeDate || Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) { setError("Enter a valid date and non-negative outcome values."); return; }
    if (values.leads === 0 && values.appointments === 0 && values.revenue === 0 && values.cost === 0 && !notes.trim()) { setError("Enter at least one result or a note before recording the outcome."); return; }
    if (persistence === "demo") { const outcome = { id: crypto.randomUUID(), date: outcomeDate, ...values, notes: notes.trim(), createdAt: new Date().toISOString() }; save({ ...plan, outcomes: [outcome, ...(plan.outcomes ?? [])] }); setNotes(""); setError(""); return; }
    setSaving(true); const result = await createPersistentGrowthOutcome({ planId: plan.id, date: outcomeDate, ...values, notes }); setSaving(false);
    if (result.error) setError(result.error); else if (result.outcome) { setPlan({ ...plan, outcomes: [result.outcome, ...(plan.outcomes ?? [])] }); setNotes(""); setError(""); }
  }

  async function removeOutcome(outcomeId: string) {
    if (!plan) return;
    const next = { ...plan, outcomes: (plan.outcomes ?? []).filter((outcome) => outcome.id !== outcomeId) };
    if (persistence === "demo") { save(next); return; }
    setSaving(true); const result = await deletePersistentGrowthOutcome(plan.id, outcomeId); setSaving(false);
    if (result.error) setError(result.error); else { setPlan(next); setError(""); }
  }

  if (!ready) return <section className="card growth-plan-state"><LoaderCircle className="spin" size={22}/><div><h2>Loading saved action plan</h2><p>Checking this browser for local prototype data.</p></div></section>;
  if (error && !plan) return <section className="card error-card growth-plan-state"><AlertTriangle size={22}/><div><h2>Action plan unavailable</h2><p>{error}</p></div></section>;
  if (!plan) return <section className="card growth-plan-builder"><div className="metric-row"><div><span className="badge blue">{persistence === "demo" ? "Local prototype" : "Shared workspace"}</span><h2>Create an action plan</h2></div><span className="metric-icon"><ClipboardList size={18}/></span></div><p>Turn this sample opportunity into an accountable validation plan. {persistence === "demo" ? "It will be saved only in this browser." : "It will be shared with members of this organization."}</p>{error && <p className="form-error">{error}</p>}<form className="form-stack" onSubmit={createPlan}>{locations.length > 0 && <label><span className="label">Location</span><select className="input" required value={locationId} onChange={(event) => setLocationId(event.target.value)}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>}<label><span className="label">Plan owner</span><input className="input" required value={owner} onChange={(event) => setOwner(event.target.value)} /></label><div className="grid grid-2"><label><span className="label">Target date</span><input className="input" required type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label><label><span className="label">Primary measure</span><select className="input" value={targetMeasure} onChange={(event) => setTargetMeasure(event.target.value)}>{opportunity.measures.map((measure) => <option key={measure}>{measure}</option>)}</select></label></div><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={16}/> Saving plan</> : <>Create action plan <ArrowRight size={16}/></>}</button></form></section>;

  const completed = plan.tasks.filter((task) => task.complete).length;
  const progress = Math.round(completed / plan.tasks.length * 100);
  return <div className="growth-plan-stack"><section className="card growth-plan-builder"><div className="metric-row"><div><span className={`badge ${plan.status === "Complete" ? "" : "blue"}`}>{plan.status}</span><h2>Action plan</h2></div><strong className="growth-plan-percent">{progress}%</strong></div>{error && <p className="form-error">{error}</p>}<div className="progress growth-plan-progress"><span style={{ width: `${progress}%` }}/></div><div className="growth-plan-meta"><span><UserRound size={15}/><small>Owner</small><strong>{plan.owner}</strong></span><span><CalendarDays size={15}/><small>Target</small><strong>{formatGrowthDate(plan.targetDate)}</strong></span><span><CheckCircle2 size={15}/><small>Measure</small><strong>{plan.targetMeasure}</strong></span></div><fieldset className="growth-task-list"><legend>Validation steps</legend>{plan.tasks.map((task, index) => <label className={task.complete ? "complete" : ""} key={task.title}><input type="checkbox" checked={task.complete} onChange={() => toggleTask(index)}/><span>{task.title}</span></label>)}</fieldset><Link className="btn btn-secondary" href="/growth/plans">View all action plans <ArrowRight size={16}/></Link></section><section className="card growth-outcome-card"><div className="metric-row"><div><span className="badge blue">Verified results</span><h2>Record an outcome</h2></div><span className="metric-icon"><DollarSign size={18}/></span></div><p>Enter actual results only. RunFloor will total these entries on the performance dashboard.</p><form className="form-stack" onSubmit={recordOutcome}><div className="growth-outcome-fields"><label><span className="label">Outcome date</span><input className="input" required type="date" value={outcomeDate} onChange={(event) => setOutcomeDate(event.target.value)}/></label><label><span className="label">Leads</span><input className="input" min="0" step="1" type="number" value={leads} onChange={(event) => setLeads(event.target.value)}/></label><label><span className="label">Appointments</span><input className="input" min="0" step="1" type="number" value={appointments} onChange={(event) => setAppointments(event.target.value)}/></label><label><span className="label">Revenue</span><input className="input" min="0" step="0.01" type="number" value={revenue} onChange={(event) => setRevenue(event.target.value)}/></label><label><span className="label">Cost</span><input className="input" min="0" step="0.01" type="number" value={cost} onChange={(event) => setCost(event.target.value)}/></label></div><label><span className="label">Verification note</span><textarea className="input" maxLength={1000} rows={3} placeholder="Source, context, or what was learned" value={notes} onChange={(event) => setNotes(event.target.value)}/></label><button className="btn btn-primary" disabled={saving} type="submit">{saving ? <><LoaderCircle className="spin" size={16}/> Saving outcome</> : <><Plus size={16}/> Record verified outcome</>}</button></form>{(plan.outcomes ?? []).length > 0 && <div className="growth-outcome-history"><h3>Recorded outcomes</h3>{plan.outcomes.map((outcome) => <div key={outcome.id}><strong>{formatGrowthDate(outcome.date)}</strong><span>{outcome.leads} leads · {outcome.appointments} appointments · ${outcome.revenue.toLocaleString()} revenue · ${outcome.cost.toLocaleString()} cost</span>{outcome.notes && <small>{outcome.notes}</small>}<button aria-label={`Remove outcome from ${formatGrowthDate(outcome.date)}`} className="icon-btn danger-button growth-outcome-remove" type="button" onClick={() => removeOutcome(outcome.id)}><Trash2 size={15}/></button></div>)}</div>}</section></div>;
}
