"use client";

import Link from "next/link";
import { AlertTriangle, BellRing, CheckCircle2, ClipboardCheck, Clock3, LoaderCircle, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import type { OperationsAlertRecord, OperationsChecklistRecord } from "@/lib/operations/data";
import type { OperationsPersistence } from "@/lib/operations/repository";
import { calculateOperationsPerformance } from "@/lib/operations/performance";
import { formatOperationsDate, readOperationsAlerts, readOperationsChecklists } from "@/lib/operations/storage";

export function OperationsPerformanceDashboard({ initialChecklists = [], initialAlerts = [], persistence = "demo", initialError = "" }: { initialChecklists?: OperationsChecklistRecord[]; initialAlerts?: OperationsAlertRecord[]; persistence?: OperationsPersistence; initialError?: string }) {
  const [checklists, setChecklists] = useState<OperationsChecklistRecord[] | null>(persistence === "supabase" ? initialChecklists : null);
  const [alerts, setAlerts] = useState<OperationsAlertRecord[] | null>(persistence === "supabase" ? initialAlerts : null);
  const [location, setLocation] = useState("All locations");
  const [error, setError] = useState(initialError);

  useEffect(() => { if (persistence === "supabase") return; const timer = window.setTimeout(() => { try { setChecklists(readOperationsChecklists()); setAlerts(readOperationsAlerts()); } catch { setError("Operations performance could not be loaded from this browser."); setChecklists([]); setAlerts([]); } }, 0); return () => window.clearTimeout(timer); }, [persistence]);

  if (checklists === null || alerts === null) return <div className="card operations-loading"><LoaderCircle className="spin" size={22}/><div><h2>Loading operations performance</h2><p>Reviewing saved checklists and alert history.</p></div></div>;
  if (error) return <div className="card operations-performance-state"><AlertTriangle size={24}/><div><h2>Performance unavailable</h2><p>{error}</p></div></div>;
  if (!checklists.length && !alerts.length) return <div className="card output empty"><div><ClipboardCheck size={28}/><h2>No operations data yet</h2><p>Create a checklist or alert to begin measuring execution.</p></div></div>;

  const visibleChecklists = location === "All locations" ? checklists : checklists.filter((item) => item.location === location || item.location === "All locations");
  const visibleAlerts = location === "All locations" ? alerts : alerts.filter((item) => item.location === location || item.location === "All locations");
  const today = new Date().toLocaleDateString("en-CA");
  const performance = calculateOperationsPerformance(visibleChecklists, visibleAlerts, today);
  const locations = [...new Set([...checklists.map((item) => item.location), ...alerts.map((item) => item.location)])].filter((item) => item !== "All locations");
  const attentionItems = [
    ...visibleChecklists.filter((item) => item.dueDate < today && item.steps.some((step) => !step.complete)).map((item) => ({ id: `checklist-${item.id}`, type: "Checklist", title: item.title, location: item.location, dueDate: item.dueDate, href: "/operations/checklists" })),
    ...visibleAlerts.filter((item) => item.status !== "Resolved" && (item.dueDate < today || item.severity === "Critical" || item.severity === "High")).map((item) => ({ id: `alert-${item.id}`, type: "Alert", title: item.title, location: item.location, dueDate: item.dueDate, href: "/operations/alerts" })),
  ];

  return <div className="operations-performance-stack">
    <div className="operations-performance-toolbar"><div><h2>Execution overview</h2><p>Calculated from saved checklist steps and alert status history.</p></div><label><span className="label">Location</span><select className="input" value={location} onChange={(event) => setLocation(event.target.value)}><option>All locations</option>{locations.map((item) => <option key={item}>{item}</option>)}</select></label></div>
    <section className="grid grid-4 operations-performance-metrics" aria-label="Operations performance summary">
      <div className="card"><div className="metric-row"><span>Step completion</span><span className="metric-icon"><CheckCircle2 size={18}/></span></div><div className="metric">{performance.completion}%</div><span className="delta">{performance.completedSteps} of {performance.totalSteps} steps</span></div>
      <div className="card"><div className="metric-row"><span>Active alerts</span><span className="metric-icon"><BellRing size={18}/></span></div><div className="metric">{performance.activeAlerts}</div><span className="delta">{performance.resolvedAlerts} resolved in history</span></div>
      <div className={`card ${performance.overdueItems ? "performance-attention" : ""}`}><div className="metric-row"><span>Overdue work</span><span className="metric-icon"><AlertTriangle size={18}/></span></div><div className="metric">{performance.overdueItems}</div><span className="delta">Incomplete checklists and active alerts</span></div>
      <div className="card"><div className="metric-row"><span>Avg. resolution</span><span className="metric-icon"><Clock3 size={18}/></span></div><div className="metric">{performance.averageResolutionHours === null ? "—" : `${performance.averageResolutionHours}h`}</div><span className="delta">From recorded alert history</span></div>
    </section>
    <section className="operations-performance-grid">
      <div className="card"><div className="performance-card-heading"><div><h2>Location comparison</h2><p>Shared “All locations” work is included for each location.</p></div><MapPin size={20}/></div>{performance.byLocation.length ? <div className="operations-location-list">{performance.byLocation.map((item) => <article key={item.location}><div><strong>{item.location}</strong><small>{item.completedSteps} of {item.totalSteps} steps</small></div><div className="operations-location-progress"><div className="progress"><span style={{ width: `${item.completion}%` }}/></div><b>{item.completion}%</b></div><span className={item.overdueItems ? "operations-location-attention" : ""}>{item.overdueItems} overdue</span><span>{item.activeAlerts} active alerts</span></article>)}</div> : <div className="performance-empty-result"><MapPin size={28}/><strong>No location comparison available</strong><p>Add location-specific checklists or alerts to compare execution.</p></div>}</div>
      <div className="card"><div className="performance-card-heading"><div><h2>Needs attention</h2><p>Overdue work plus active high- or critical-severity alerts.</p></div><AlertTriangle size={20}/></div>{attentionItems.length ? <div className="operations-attention-list">{attentionItems.map((item) => <Link href={item.href} key={item.id}><span className={`badge ${item.type === "Alert" ? "amber" : "blue"}`}>{item.type}</span><div><strong>{item.title}</strong><small>{item.location} · Due {formatOperationsDate(item.dueDate)}</small></div></Link>)}</div> : <div className="performance-empty-result"><CheckCircle2 size={28}/><strong>No priority exceptions</strong><p>No overdue work or severe active alerts in this view.</p></div>}</div>
    </section>
    <div className="card operations-performance-method"><strong>How these numbers are calculated</strong><p>Completion equals completed checklist steps divided by all checklist steps. Overdue work includes incomplete checklists and unresolved alerts past their due date. Average resolution time uses the time between alert creation and its latest recorded resolution. RunFloor does not infer missing results.</p></div>
  </div>;
}
