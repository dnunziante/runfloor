"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, CirclePause, FileText, FolderOpen, Lightbulb, LoaderCircle, MapPin, MoreHorizontal, Play, Plus, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { generateOperationsChecklist, saveOperationsSchedule, setOperationsScheduleStatus } from "@/app/operations/actions";
import type { OperationsChecklistRecord, OperationsProcedureRecord, OperationsScheduleRecord } from "@/lib/operations/data";
import { getNextScheduleDate } from "@/lib/operations/schedules";
import type { OperationsPersistence } from "@/lib/operations/repository";
import { formatOperationsDate, readOperationsChecklists, readOperationsProcedures, readOperationsSchedules, writeOperationsChecklists, writeOperationsSchedules } from "@/lib/operations/storage";

export function OperationsScheduleManager({ initialSchedules = [], initialProcedures = [], persistence = "demo", initialError = "", canManage = true }: { initialSchedules?: OperationsScheduleRecord[]; initialProcedures?: OperationsProcedureRecord[]; persistence?: OperationsPersistence; initialError?: string; canManage?: boolean }) {
  const publishedInitial = initialProcedures.filter((item) => item.status === "Published");
  const [schedules, setSchedules] = useState<OperationsScheduleRecord[] | null>(persistence === "supabase" ? initialSchedules : null);
  const [procedures, setProcedures] = useState<OperationsProcedureRecord[]>(persistence === "supabase" ? publishedInitial : []);
  const [procedureId, setProcedureId] = useState(publishedInitial[0]?.id ?? "");
  const [frequency, setFrequency] = useState<OperationsScheduleRecord["frequency"]>("Daily");
  const [location, setLocation] = useState("Charleston");
  const [owner, setOwner] = useState("");
  const [nextRunDate, setNextRunDate] = useState("");
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");

  useEffect(() => { if (persistence === "supabase") return; const timer = window.setTimeout(() => { try { const available = readOperationsProcedures().filter((item) => item.status === "Published"); setProcedures(available); setProcedureId(available[0]?.id ?? ""); setSchedules(readOperationsSchedules()); } catch { setError("Recurring schedules could not be loaded from this browser."); setSchedules([]); } }, 0); return () => window.clearTimeout(timer); }, [persistence]);

  function save(next: OperationsScheduleRecord[]) { try { writeOperationsSchedules(next); setSchedules(next); setError(""); } catch { setError("Schedule changes could not be saved in this browser."); } }

  async function createSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const procedure = procedures.find((item) => item.id === procedureId);
    if (!procedure || owner.trim().length < 2 || !nextRunDate) { setError("Select a published procedure and add an owner and first run date."); return; }
    const input = { procedureId: procedure.id, procedureTitle: procedure.title, frequency, location, owner: owner.trim(), nextRunDate };
    if (persistence === "supabase") { const result = await saveOperationsSchedule(input); if (result.error || !result.record) { setError(result.error ?? "Schedule could not be created."); return; } setSchedules([result.record, ...(schedules ?? [])]); setError(""); }
    else { const schedule: OperationsScheduleRecord = { ...input, id: crypto.randomUUID(), status: "Active", lastGeneratedAt: null, createdAt: new Date().toISOString() }; save([schedule, ...(schedules ?? [])]); }
    setOwner(""); setNextRunDate(""); setNotice(`${procedure.title} schedule created.`);
  }

  async function toggleStatus(id: string) {
    if (!schedules) return;
    const item = schedules.find((schedule) => schedule.id === id); if (!item) return; const status = item.status === "Active" ? "Paused" : "Active";
    if (persistence === "demo") save(schedules.map((schedule) => schedule.id === id ? { ...schedule, status } : schedule)); else { const result = await setOperationsScheduleStatus(id, status); if (result.error) { setError(result.error); return; } setSchedules(schedules.map((schedule) => schedule.id === id ? { ...schedule, status } : schedule)); }
    setNotice("");
  }

  async function generateChecklist(schedule: OperationsScheduleRecord) {
    if (persistence === "supabase") { const result = await generateOperationsChecklist(schedule); if ("error" in result && result.error) { setError(result.error); return; } if (!("lastGeneratedAt" in result)) return; setSchedules((schedules ?? []).map((item) => item.id === schedule.id ? { ...item, lastGeneratedAt: result.lastGeneratedAt ?? item.lastGeneratedAt, nextRunDate: result.nextRunDate ?? item.nextRunDate } : item)); setNotice(`Checklist generated for ${schedule.procedureTitle}. The next run date moved forward automatically.`); setError(""); return; }
    const procedure = readOperationsProcedures().find((item) => item.id === schedule.procedureId);
    if (!procedure) { setError("The source procedure is no longer available."); return; }
    try {
      const checklists = readOperationsChecklists();
      const generated: OperationsChecklistRecord = { id: crypto.randomUUID(), title: `${procedure.title} · ${formatOperationsDate(schedule.nextRunDate)}`, location: schedule.location, owner: schedule.owner, dueDate: schedule.nextRunDate, createdAt: new Date().toISOString(), steps: procedure.steps.map((title) => ({ id: crypto.randomUUID(), title, complete: false })) };
      writeOperationsChecklists([generated, ...checklists]);
      const generatedAt = new Date().toISOString();
      save((schedules ?? []).map((item) => item.id === schedule.id ? { ...item, lastGeneratedAt: generatedAt, nextRunDate: getNextScheduleDate(item.nextRunDate, item.frequency) } : item));
      setNotice(`Checklist generated for ${schedule.procedureTitle}. The next run date moved forward automatically.`);
    } catch { setError("The scheduled checklist could not be generated in this browser."); }
  }

  if (schedules === null && !error) return <div className="card operations-loading"><LoaderCircle className="spin" size={22}/><div><h2>Loading recurring schedules</h2><p>Checking this browser for saved procedures and schedules.</p></div></div>;
  const active = schedules?.filter((item) => item.status === "Active").length ?? 0;
  const upcoming = [...(schedules ?? [])].filter((item) => item.status === "Active").sort((a, b) => a.nextRunDate.localeCompare(b.nextRunDate));

  if (!canManage) return <div className="operations-schedule-stack">
    {error && <p className="form-error operations-schedule-message"><AlertTriangle size={15}/>{error}</p>}
    <section><div className="section-heading operations-list-heading"><div><h2>Recurring work</h2><p>{schedules?.length ?? 0} schedules</p></div></div>{schedules?.length ? <div className="operations-schedule-list">{schedules.map((schedule) => <article className="card operations-schedule-card" key={schedule.id}><div className="metric-row"><div className="operations-alert-badges"><span className={`badge ${schedule.status === "Active" ? "" : "amber"}`}>{schedule.status}</span><span className="badge blue">{schedule.frequency}</span></div><small>Next {formatOperationsDate(schedule.nextRunDate)}</small></div><h2>{schedule.procedureTitle}</h2><div className="operations-assigned-meta"><span><MapPin size={14}/>{schedule.location}</span><span><UserRound size={14}/>{schedule.owner}</span><span><CalendarClock size={14}/>Every {schedule.frequency.toLowerCase()}</span></div><p>{schedule.lastGeneratedAt ? `Last generated ${new Date(schedule.lastGeneratedAt).toLocaleString()}` : "No checklist generated yet."}</p></article>)}</div> : <div className="card output empty"><div><CalendarClock size={28}/><h2>No recurring schedules</h2><p>A manager has not created recurring work yet.</p></div></div>}</section>
  </div>;

  return <div className="rs-workspace">
    <section className="rs-metrics" aria-label="Schedule summary"><article><span className="green"><CalendarClock/></span><div><small>Active schedules</small><strong>{active}</strong><p>Running as scheduled</p></div></article><article><span><CirclePause/></span><div><small>Paused</small><strong>{(schedules?.length ?? 0) - active}</strong><p>Retained without generating work</p></div></article><article><span className="blue"><FileText/></span><div><small>Published procedures</small><strong>{procedures.length}</strong><p>Available as schedule templates</p></div></article><article><span className="orange"><CalendarClock/></span><div><small>Upcoming runs</small><strong>{upcoming.length}</strong><Link href="/operations/calendar">View calendar <ArrowRight/></Link></div></article></section>
    {error && <p className="form-error operations-schedule-message"><AlertTriangle size={15}/>{error}</p>}{notice && <p className="operations-schedule-notice"><CheckCircle2 size={15}/>{notice}</p>}
    <div className="rs-layout"><aside className="rs-card rs-builder"><span className="rs-chip">{persistence === "supabase" ? "Organization schedules" : "Local prototype"}</span><h2>Create a new schedule</h2><p>Choose a published procedure to define the checklist steps.</p>{procedures.length ? <form onSubmit={createSchedule}><label><span>Procedure *</span><select value={procedureId} onChange={(event) => setProcedureId(event.target.value)}>{procedures.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><Link href="/operations/procedures">View procedure <ArrowRight/></Link><div><label><span>Frequency *</span><select value={frequency} onChange={(event) => setFrequency(event.target.value as OperationsScheduleRecord["frequency"])}><option>Daily</option><option>Weekly</option><option>Monthly</option></select></label><label><span>Location *</span><select value={location} onChange={(event) => setLocation(event.target.value)}><option>Charleston</option><option>Summerville</option><option>All locations</option></select></label></div><label><span>Owner *</span><input required value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Person or team"/></label><label><span>Start date *</span><input required type="date" value={nextRunDate} onChange={(event) => setNextRunDate(event.target.value)}/></label><details><summary>Additional options</summary><p>Schedules generate from the latest published version of the selected procedure.</p></details><button type="submit"><Plus/> Create schedule</button></form> : <div className="operations-schedule-empty"><AlertTriangle size={22}/><strong>No published procedures</strong><p>Publish a procedure before creating a recurring schedule.</p><Link className="btn btn-secondary" href="/operations/procedures">Manage procedures</Link></div>}</aside>
      <div className="rs-main"><section className="rs-card rs-upcoming"><header><h2>Upcoming scheduled work</h2><Link href="/operations/calendar">View all <ArrowRight/></Link></header>{upcoming.length ? <div className="rs-table-wrap"><table><thead><tr><th>Due date</th><th>Procedure</th><th>Location</th><th>Owner</th><th>Status</th><th>Actions</th></tr></thead><tbody>{upcoming.slice(0,6).map((schedule) => <tr key={schedule.id}><td>{formatOperationsDate(schedule.nextRunDate)}</td><td><strong>{schedule.procedureTitle}</strong><small>{schedule.frequency}</small></td><td>{schedule.location}</td><td>{schedule.owner}</td><td><span>● Scheduled</span></td><td><button title="Generate checklist now" onClick={() => generateChecklist(schedule)}><Play/></button><button title="Pause schedule" onClick={() => toggleStatus(schedule.id)}><CirclePause/></button></td></tr>)}</tbody></table></div> : <div className="rs-empty"><CalendarClock/><strong>No upcoming work</strong><p>Create or resume a schedule to see its next run.</p></div>}</section>
        <div className="rs-bottom"><section className="rs-card rs-templates"><header><div><FolderOpen/><h2>Schedule templates</h2></div></header>{procedures.slice(0,4).map((procedure) => <button key={procedure.id} onClick={() => setProcedureId(procedure.id)}><span><strong>{procedure.title}</strong><small>{procedure.category} · {procedure.steps.length} steps</small></span><b>Use template</b></button>)}<Link href="/operations/procedures">Browse all procedures <ArrowRight/></Link></section><div className="rs-side"><aside className="rs-card rs-tip"><Lightbulb/><div><h2>Pro tip</h2><strong>Start with templates</strong><p>Use published procedures to ensure consistency across all locations.</p><Link href="/operations/procedures">Browse templates <ArrowRight/></Link></div></aside><blockquote>“Consistent execution creates exceptional results.”<small>— RunFloor</small></blockquote></div></div>
      </div>
    </div>
    {(schedules ?? []).some((schedule) => schedule.status === "Paused") && <details className="rs-paused rs-card"><summary>Paused schedules ({(schedules ?? []).length - active})</summary><div>{(schedules ?? []).filter((schedule) => schedule.status === "Paused").map((schedule) => <article key={schedule.id}><span><strong>{schedule.procedureTitle}</strong><small>{schedule.location} · {schedule.owner}</small></span><button onClick={() => toggleStatus(schedule.id)}><Play/> Resume</button><MoreHorizontal/></article>)}</div></details>}
  </div>;
}
