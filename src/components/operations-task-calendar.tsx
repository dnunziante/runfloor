"use client";

import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, LoaderCircle, MapPin, Repeat2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { OperationsAlertRecord, OperationsChecklistRecord, OperationsScheduleRecord } from "@/lib/operations/data";
import type { OperationsPersistence } from "@/lib/operations/repository";
import { readOperationsAlerts, readOperationsChecklists, readOperationsSchedules } from "@/lib/operations/storage";

type CalendarEvent = { id: string; date: string; title: string; location: string; type: "Checklist" | "Alert" | "Schedule"; status: "Completed" | "Active" | "Scheduled" | "Overdue"; href: string };
const typeOptions = ["All work", "Checklist", "Alert", "Schedule"] as const;

function isoDate(year: number, month: number, day: number) { return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }

export function OperationsTaskCalendar({ initialChecklists = [], initialAlerts = [], initialSchedules = [], persistence = "demo", initialError = "", tailored = false }: { initialChecklists?: OperationsChecklistRecord[]; initialAlerts?: OperationsAlertRecord[]; initialSchedules?: OperationsScheduleRecord[]; persistence?: OperationsPersistence; initialError?: string; tailored?: boolean }) {
  const now = useMemo(() => new Date(), []);
  const today = isoDate(now.getFullYear(), now.getMonth(), now.getDate());
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [checklists, setChecklists] = useState<OperationsChecklistRecord[] | null>(persistence === "supabase" ? initialChecklists : null);
  const [alerts, setAlerts] = useState<OperationsAlertRecord[]>(persistence === "supabase" ? initialAlerts : []);
  const [schedules, setSchedules] = useState<OperationsScheduleRecord[]>(persistence === "supabase" ? initialSchedules : []);
  const [location, setLocation] = useState("All locations");
  const [typeFilter, setTypeFilter] = useState<(typeof typeOptions)[number]>("All work");
  const [error, setError] = useState(initialError);

  useEffect(() => { if (persistence === "supabase") return; const timer = window.setTimeout(() => { try { setChecklists(readOperationsChecklists()); setAlerts(readOperationsAlerts()); setSchedules(readOperationsSchedules()); } catch { setError("The operations calendar could not be loaded from this browser."); setChecklists([]); } }, 0); return () => window.clearTimeout(timer); }, [persistence]);

  if (checklists === null && !error) return <div className="card operations-loading"><LoaderCircle className="spin" size={22}/><div><h2>Loading operations calendar</h2><p>Combining checklist, alert, and schedule dates.</p></div></div>;
  if (error) return <div className="card operations-performance-state"><AlertTriangle size={24}/><div><h2>Calendar unavailable</h2><p>{error}</p></div></div>;

  const events: CalendarEvent[] = [
    ...(checklists ?? []).map((item) => { const complete = item.steps.length > 0 && item.steps.every((step) => step.complete); return { id: `checklist-${item.id}`, date: item.dueDate, title: item.title, location: item.location, type: "Checklist" as const, status: complete ? "Completed" as const : item.dueDate < today ? "Overdue" as const : "Active" as const, href: "/operations/checklists" }; }),
    ...alerts.map((item) => ({ id: `alert-${item.id}`, date: item.dueDate, title: item.title, location: item.location, type: "Alert" as const, status: item.status === "Resolved" ? "Completed" as const : item.dueDate < today ? "Overdue" as const : "Active" as const, href: "/operations/alerts" })),
    ...schedules.filter((item) => item.status === "Active").map((item) => ({ id: `schedule-${item.id}`, date: item.nextRunDate, title: item.procedureTitle, location: item.location, type: "Schedule" as const, status: item.nextRunDate < today ? "Overdue" as const : "Scheduled" as const, href: "/operations/schedules" })),
  ];
  const locations = [...new Set(events.map((item) => item.location).filter((item) => item !== "All locations"))];
  const filtered = events.filter((item) => (location === "All locations" || item.location === location || item.location === "All locations") && (typeFilter === "All work" || item.type === typeFilter));
  const firstOffset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstOffset + daysInMonth) / 7) * 7 }, (_, index) => { const day = index - firstOffset + 1; return day > 0 && day <= daysInMonth ? day : null; });
  const monthEvents = filtered.filter((item) => item.date.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`));
  const overdue = filtered.filter((item) => item.status === "Overdue").length;
  const completed = filtered.filter((item) => item.status === "Completed").length;

  function changeMonth(offset: number) { setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1)); }

  return <div className={`operations-calendar-stack${tailored ? " operations-calendar-tailored" : ""}`}>
    <section className="grid grid-3 operations-calendar-metrics"><div className="card"><div className="metric-row"><span>This month</span><span className="metric-icon"><CalendarDays size={18}/></span></div><div className="metric">{monthEvents.length}</div><span className="delta">Visible dated items</span></div><div className={`card ${overdue ? "performance-attention" : ""}`}><div className="metric-row"><span>Overdue</span><span className="metric-icon"><Clock3 size={18}/></span></div><div className="metric">{overdue}</div><span className="delta">Across all visible dates</span></div><div className="card"><div className="metric-row"><span>Completed</span><span className="metric-icon"><CheckCircle2 size={18}/></span></div><div className="metric">{completed}</div><span className="delta">Resolved alerts and finished checklists</span></div></section>
    <div className="card operations-calendar-controls"><div className="operations-calendar-month"><button className="icon-btn" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={19}/></button><h2>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><button className="icon-btn" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={19}/></button><button className="btn btn-ghost" onClick={() => setMonth(new Date(now.getFullYear(), now.getMonth(), 1))}>Today</button></div><div className="operations-calendar-filters"><label><span className="label">Location</span><select className="input" value={location} onChange={(event) => setLocation(event.target.value)}><option>All locations</option>{locations.map((item) => <option key={item}>{item}</option>)}</select></label><label><span className="label">Work type</span><select className="input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as (typeof typeOptions)[number])}>{typeOptions.map((item) => <option key={item}>{item}</option>)}</select></label></div></div>
    <div className="operations-calendar-scroll"><section className="card operations-calendar" aria-label={`${month.toLocaleDateString(undefined, { month: "long", year: "numeric" })} operations calendar`}><div className="operations-calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong key={day}>{day}</strong>)}</div><div className="operations-calendar-grid">{cells.map((day, index) => { const date = day ? isoDate(month.getFullYear(), month.getMonth(), day) : ""; const dayEvents = day ? filtered.filter((item) => item.date === date) : []; return <div className={`${day ? "" : "outside"} ${date === today ? "today" : ""}`} key={`${date}-${index}`}><span className="operations-calendar-day">{day}</span>{dayEvents.map((item) => <Link className={`operations-calendar-event ${item.status.toLowerCase()}`} href={item.href} key={item.id}><span>{item.type === "Checklist" ? <ClipboardCheck size={12}/> : item.type === "Alert" ? <AlertTriangle size={12}/> : <Repeat2 size={12}/>}<strong>{item.title}</strong></span><small><MapPin size={10}/>{item.location} · {item.status}</small></Link>)}</div>; })}</div></section></div>
    {!monthEvents.length && <div className="card output empty"><div><CalendarDays size={28}/><h2>No work in this month</h2><p>Change the month or filters to view other dated operational work.</p></div></div>}
  </div>;
}
