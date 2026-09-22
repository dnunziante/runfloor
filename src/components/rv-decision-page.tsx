"use client";

import { useState } from "react";
import { CalendarDays, Check, CheckCircle2, ClipboardList, Clock3, FileText, Filter, Plus, Search, Target } from "lucide-react";
import { saveExecutiveDecision } from "@/app/executive/decisions/actions";
import { ReportingPeriodSelector } from "@/components/reporting-period-selector";
import type { ExecutiveDecision, ExecutiveDecisionInput, ExecutiveDecisionStatus } from "@/lib/executive/decisions";
import styles from "./rv-decision-page.module.css";

type Data = { reportingPeriod: string; availablePeriods: string[]; decisions: ExecutiveDecision[]; summary: { total: number; open: number; validated: number; dueForReview: number }; persistence: "demo" | "supabase"; error: string };
type Priority = { id: string; title: string };
const empty = (period: string, priority: string): ExecutiveDecisionInput => ({ priorityKey: priority, reportingPeriod: `${period}-01`, title: "", decision: "", rationale: "", ownerName: "", reviewDate: "", expectedOutcome: "", measuredOutcome: "", status: "open" });
const labels: Record<ExecutiveDecisionStatus, string> = { open: "Open", validated: "Validated", revised: "Revised", reversed: "Reversed" };

export function RvDecisionPage({ data, priorities }: { data: Data; priorities: Priority[] }) {
  const [items, setItems] = useState(data.decisions);
  const [draft, setDraft] = useState(empty(data.reportingPeriod, priorities[0]?.id ?? "general-leadership"));
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(data.error);
  const counts = { total: items.length, open: items.filter((item) => item.status === "open").length, validated: items.filter((item) => item.status === "validated").length, due: items.filter((item) => item.status === "open" && item.reviewDate <= new Date().toISOString().slice(0, 10)).length };
  const shown = items.filter((item) => (filter === "all" || (filter === "completed" ? item.status !== "open" : filter === "due" ? item.status === "open" && item.reviewDate <= new Date().toISOString().slice(0, 10) : item.status === filter)) && `${item.title} ${item.decision} ${item.ownerName}`.toLowerCase().includes(query.toLowerCase()));
  function update(patch: Partial<ExecutiveDecisionInput>) { setDraft((current) => ({ ...current, ...patch })); }
  async function save(input: ExecutiveDecisionInput) {
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await saveExecutiveDecision(input);
      if (result.error) { setError(result.error); return; }
      const saved: ExecutiveDecision = { ...input, id: result.decisionId ?? input.id ?? crypto.randomUUID(), updatedAt: new Date().toISOString() };
      setItems((current) => input.id ? current.map((item) => item.id === input.id ? saved : item) : [saved, ...current]);
      setDraft(empty(data.reportingPeriod, priorities[0]?.id ?? "general-leadership"));
      setMessage(data.persistence === "demo" ? "Decision added to this demo view." : "Decision saved for this workspace.");
    } catch { setError("The decision could not be saved. Try again."); }
    finally { setSaving(false); }
  }
  return <div className={styles.page}>
    <section className={styles.hero}><div><span>Executive Advisor</span><h1>Remember why a decision <br/>was made — and whether <br/><em>it worked.</em></h1><p>Connect leadership decisions to priorities, ownership, expected outcomes, and measured results.</p></div><blockquote>Same Roads.<br/>Bigger Results.</blockquote><a href="#decision-form"><ClipboardList size={17}/>View decision guide</a></section>
    <div className={styles.body}>
      <div className={styles.overview}><div className={styles.period}><span className={styles.periodIcon}><CalendarDays/></span><ReportingPeriodSelector action="/executive/decisions" periods={data.availablePeriods} selected={data.reportingPeriod} label="Decision period"/></div>{([["Recorded decisions",counts.total,FileText,"green"],["Open decisions",counts.open,Target,"red"],["Validated outcomes",counts.validated,CheckCircle2,"blue"],["Due for review",counts.due,Clock3,"amber"]] as const).map(([label,value,Icon,tone]) => <article className={styles.stat} key={label}><span className={`${styles.statIcon} ${styles[tone]}`}><Icon/></span><div><span>{label}</span><strong>{value}</strong></div></article>)}</div>
      <div className={styles.columns}>
        <form id="decision-form" className={styles.panel} onSubmit={(event) => { event.preventDefault(); void save(draft); }}><header className={styles.panelHead}><span className={styles.headIcon}><FileText/></span><div><h2>Record a leadership decision</h2><p>Capture the decision, why it was made, who owns it, and how success will be measured.</p></div></header>
          <div className={styles.fields}>
            <label>Related priority<select value={draft.priorityKey} onChange={(event) => update({ priorityKey: event.target.value })}>{priorities.length ? priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.title}</option>) : <option value="general-leadership">General leadership</option>}</select></label>
            <label>Decision owner<input required minLength={2} maxLength={160} placeholder="Select or enter an owner..." value={draft.ownerName} onChange={(event) => update({ ownerName: event.target.value })}/></label>
            <label className={styles.wide}>Decision title<input required minLength={3} maxLength={180} placeholder="Enter a clear, short title..." value={draft.title} onChange={(event) => update({ title: event.target.value })}/></label>
            <label>What was decided?<textarea required minLength={3} maxLength={3000} placeholder="Describe the decision..." value={draft.decision} onChange={(event) => update({ decision: event.target.value })}/></label>
            <label>Why this decision was made<textarea maxLength={3000} placeholder="Share the context, data, or reasoning..." value={draft.rationale} onChange={(event) => update({ rationale: event.target.value })}/></label>
            <label>Expected outcome<input required minLength={3} maxLength={2000} placeholder="What did we expect to happen?" value={draft.expectedOutcome} onChange={(event) => update({ expectedOutcome: event.target.value })}/></label>
            <label>Measured outcome <small>(optional while open)</small><input maxLength={2000} placeholder="What actually happened?" value={draft.measuredOutcome} onChange={(event) => update({ measuredOutcome: event.target.value })}/></label>
            <label>Review date<input required type="date" value={draft.reviewDate} onChange={(event) => update({ reviewDate: event.target.value })}/></label>
            <label>Status<select value={draft.status} onChange={(event) => update({ status: event.target.value as ExecutiveDecisionStatus })}>{Object.entries(labels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>{error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={styles.success} role="status">{message}</p>}<footer><button type="button" onClick={() => { setDraft(empty(data.reportingPeriod, priorities[0]?.id ?? "general-leadership")); setError(""); }}>Cancel</button><button type="submit" disabled={saving}><FileText size={16}/>{saving ? "Saving..." : "Save decision"}</button></footer></form>
        <div className={styles.right}><section className={styles.panel}><header className={styles.listHead}><span className={styles.headIcon}><FileText/></span><div><h2>Recent leadership decisions</h2><p>Track decisions, review outcomes, and keep your team aligned.</p></div><label className={styles.search}><Search size={16}/><input aria-label="Search decisions" placeholder="Search decisions..." value={query} onChange={(event) => setQuery(event.target.value)}/></label><Filter className={styles.filterIcon} size={17}/></header><div className={styles.tabs}>{[["all","All"],["open","Open"],["completed","Completed"],["due","Due for review"]].map(([value,label]) => <button className={filter === value ? styles.active : ""} type="button" key={value} onClick={() => setFilter(value)}>{label}</button>)}</div><div className={styles.results}>{shown.length ? shown.map((item) => <DecisionItem key={item.id} item={item} priorities={priorities} save={save} saving={saving}/>) : <div className={styles.empty}><ClipboardList/><h3>{items.length ? "No decisions match this view" : "No decisions recorded yet"}</h3><p>{items.length ? "Try another search or filter." : "Start by capturing your first leadership decision for this reporting period."}</p><a href="#decision-form"><Plus size={17}/>Add your first decision</a></div>}</div></section><aside className={styles.why}><Target/><div><h2>Why this matters</h2><p>Documenting decisions creates accountability, helps measure what works, and builds a playbook for future growth.</p><ul><li><Check/>Keep your team aligned</li><li><Check/>Track real outcomes</li><li><Check/>Build institutional knowledge</li></ul></div><blockquote>“Better decisions<br/>today. Bigger<br/>tomorrows.”<small>— RunFloor</small></blockquote></aside></div>
      </div>
    </div>
  </div>;
}

function DecisionItem({ item, priorities, save, saving }: { item: ExecutiveDecision; priorities: Priority[]; save: (input: ExecutiveDecisionInput) => Promise<void>; saving: boolean }) {
  const [value, setValue] = useState<ExecutiveDecisionInput>(item);
  return <article className={styles.item}><div><span className={styles.itemStatus}>{labels[item.status]}</span><h3>{item.title}</h3><p>{item.decision}</p><small>Owner: {item.ownerName} · Review {item.reviewDate}</small></div><details><summary>Edit decision and outcome</summary><form onSubmit={(event) => { event.preventDefault(); void save(value); }}><label>Related priority<select value={value.priorityKey} onChange={(event) => setValue({ ...value, priorityKey: event.target.value })}>{priorities.length ? priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.title}</option>) : <option value="general-leadership">General leadership</option>}</select></label><label>Owner<input required value={value.ownerName} onChange={(event) => setValue({ ...value, ownerName: event.target.value })}/></label><label>Title<input required value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })}/></label><label>Decision<textarea required value={value.decision} onChange={(event) => setValue({ ...value, decision: event.target.value })}/></label><label>Reasoning<textarea value={value.rationale} onChange={(event) => setValue({ ...value, rationale: event.target.value })}/></label><label>Expected outcome<textarea required value={value.expectedOutcome} onChange={(event) => setValue({ ...value, expectedOutcome: event.target.value })}/></label><label>Measured outcome<textarea value={value.measuredOutcome} onChange={(event) => setValue({ ...value, measuredOutcome: event.target.value })}/></label><label>Review date<input type="date" required value={value.reviewDate} onChange={(event) => setValue({ ...value, reviewDate: event.target.value })}/></label><label>Status<select value={value.status} onChange={(event) => setValue({ ...value, status: event.target.value as ExecutiveDecisionStatus })}>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><button disabled={saving} type="submit">Save changes</button></form></details></article>;
}
