"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, FileText, ListChecks, LoaderCircle, MoreVertical, Plus, Sparkles, Target, Trophy, UserRound, Users } from "lucide-react";
import { approveGeneratedOperationsChecklist, generateChecklistFromDocument, saveOperationsChecklist, toggleOperationsChecklistStep, type ChecklistSectionInput } from "@/app/operations/actions";
import type { OperationsChecklistRecord, OperationsProcedureRecord } from "@/lib/operations/data";
import type { OperationsPersistence } from "@/lib/operations/repository";
import { formatOperationsDate, readOperationsChecklists, writeOperationsChecklists } from "@/lib/operations/storage";

type Props = {
  initialChecklists?: OperationsChecklistRecord[];
  initialProcedures?: OperationsProcedureRecord[];
  persistence?: OperationsPersistence;
  initialError?: string;
};

export function OperationsChecklistWorkspace({ initialChecklists = [], initialProcedures = [], persistence = "demo", initialError = "" }: Props) {
  const [checklists, setChecklists] = useState<OperationsChecklistRecord[] | null>(persistence === "supabase" ? initialChecklists : null);
  const [error, setError] = useState(initialError);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("Charleston");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [method, setMethod] = useState<"manual" | "document">("manual");
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<{ title: string; sections: ChecklistSectionInput[]; unclearItems: string[] } | null>(null);

  useEffect(() => {
    if (persistence === "supabase") return;
    const timer = window.setTimeout(() => {
      try { setChecklists(readOperationsChecklists()); }
      catch { setError("Saved checklists could not be loaded from this browser."); setChecklists([]); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [persistence]);

  function save(next: OperationsChecklistRecord[]) {
    try { writeOperationsChecklists(next); setChecklists(next); setError(""); }
    catch { setError("Checklist changes could not be saved in this browser."); }
  }

  async function createChecklist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const stepTitles = stepsText.split("\n").map((step) => step.trim()).filter(Boolean);
    if (title.trim().length < 2 || owner.trim().length < 2 || !dueDate || !stepTitles.length) return setError("Add a title, owner, due date, and at least one checklist step.");
    const input = { title: title.trim(), location, owner: owner.trim(), dueDate, steps: stepTitles.map((stepTitle) => ({ id: "", title: stepTitle, complete: false })) };
    if (persistence === "supabase") {
      const result = await saveOperationsChecklist(input);
      if (result.error || !result.record) return setError(result.error ?? "Checklist could not be created.");
      setChecklists([result.record, ...(checklists ?? [])]);
    } else {
      save([{ ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString(), steps: stepTitles.map((stepTitle) => ({ id: crypto.randomUUID(), title: stepTitle, complete: false })) }, ...(checklists ?? [])]);
    }
    setTitle(""); setOwner(""); setDueDate(""); setStepsText(""); setError("");
  }

  async function generateChecklist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setGenerating(true); setError("");
    const result = await generateChecklistFromDocument(new FormData(event.currentTarget));
    setGenerating(false);
    if (result.error || !result.draft) return setError(result.error ?? "Checklist could not be generated.");
    setDraft(result.draft);
  }

  async function approveDraft() {
    if (!draft || !owner.trim() || !dueDate) return setError("Add an owner and due date before approval.");
    const result = await approveGeneratedOperationsChecklist({ title: draft.title, location, owner: owner.trim(), dueDate, sections: draft.sections });
    if (result.error || !result.record) return setError(result.error ?? "Checklist could not be created.");
    setChecklists([result.record, ...(checklists ?? [])]); setDraft(null); setError("");
  }

  async function toggleStep(checklistId: string, stepId: string) {
    if (!checklists) return;
    const previous = checklists;
    const step = previous.find((item) => item.id === checklistId)?.steps.find((item) => item.id === stepId);
    if (!step) return;
    const next = previous.map((checklist) => checklist.id === checklistId ? { ...checklist, steps: checklist.steps.map((item) => item.id === stepId ? { ...item, complete: !item.complete } : item) } : checklist);
    if (persistence === "demo") save(next);
    else { setChecklists(next); const result = await toggleOperationsChecklistStep(checklistId, stepId, !step.complete); if (result.error) { setChecklists(previous); setError(result.error); } }
  }

  if (checklists === null && !error) return <div className="card operations-loading"><LoaderCircle className="spin"/><div><h2>Loading checklists</h2><p>Preparing your operational work.</p></div></div>;

  return <section className="checklist-workspace">
    <nav className="checklist-action-tabs" aria-label="Checklist actions">
      <a className="active" href="#checklist-builder"><Plus/> Create checklist</a>
      <Link href="/operations/procedures"><ClipboardCheck/> Templates</Link>
      <a href="#assigned-checklists"><UserRound/> My assignments</a>
      <a href="#assigned-checklists"><ListChecks/> All checklists</a>
    </nav>
    {error && <p className="form-error checklist-error"><AlertTriangle/>{error}</p>}
    <div className="checklist-workspace-grid">
      <section className="checklist-panel checklist-builder" id="checklist-builder">
        <span className="checklist-kicker">Checklist builder</span><h2>{draft ? "Review checklist" : "Create a checklist"}</h2><p>Start from scratch or use an existing procedure to save time.</p>
        {!draft && <div className="checklist-methods"><button className={method === "manual" ? "active" : ""} onClick={() => setMethod("manual")} type="button"><Plus/> Create manually</button><button className={method === "document" ? "active" : ""} onClick={() => setMethod("document")} type="button"><FileText/> Generate from document</button></div>}
        {!draft && method === "manual" && <form className="checklist-builder-form" onSubmit={createChecklist}>
          <label className="wide">Checklist title *<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. End of Day Store Closure"/></label>
          <label>Location *<select value={location} onChange={(event) => setLocation(event.target.value)}><option>Charleston</option><option>Summerville</option><option>All locations</option></select></label>
          <label>Owner *<input required value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Select owner"/></label>
          <label>Due date *<input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label>
          <label>Checklist steps *<textarea required rows={3} value={stepsText} onChange={(event) => setStepsText(event.target.value)} placeholder={'One step per line\nConfirm closing walk\nSecure inventory'}/></label>
          <button className="checklist-submit wide"><span>Create checklist</span><ArrowRight/></button>
        </form>}
        {!draft && method === "document" && <form className="checklist-builder-form" onSubmit={generateChecklist}>
          <label className="wide">Operational document *<input name="file" required type="file" accept=".pdf,.docx,.md,.txt"/></label>
          <label>Location *<select value={location} onChange={(event) => setLocation(event.target.value)}><option>Charleston</option><option>Summerville</option><option>All locations</option></select></label>
          <label>Owner *<input required value={owner} onChange={(event) => setOwner(event.target.value)}/></label>
          <label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label>
          <label>Instructions<textarea name="instruction" rows={3}/></label>
          <button className="checklist-submit wide" disabled={generating}>{generating ? <><LoaderCircle className="spin"/> Generating…</> : <><Sparkles/> Generate checklist</>}</button>
        </form>}
        {draft && <div className="checklist-draft"><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })}/>{draft.sections.map((section, index) => <article key={`${section.title}-${index}`}><strong>{section.title}</strong><span>{section.steps.length} steps</span></article>)}<div><button onClick={() => setDraft(null)}>Discard</button><button className="checklist-submit" onClick={approveDraft}><CheckCircle2/> Approve &amp; create</button></div></div>}
      </section>
      <section className="checklist-panel checklist-templates">
        <header><h2>Recent templates</h2><Link href="/operations/procedures">View all</Link></header>
        <div>{initialProcedures.slice(0, 5).map((procedure) => <Link href="/operations/procedures" key={procedure.id}><span><ClipboardCheck/></span><div><strong>{procedure.title}</strong><small>{procedure.category}</small></div><em>{procedure.status}</em><MoreVertical/></Link>)}</div>
        {!initialProcedures.length && <p className="checklist-empty-copy">No procedure templates are available yet.</p>}
        <Link className="checklist-panel-link" href="/operations/procedures"><BookOpen/> Browse template library</Link>
      </section>
      <section className="checklist-panel checklist-assigned" id="assigned-checklists">
        <header><h2>Assigned checklists</h2><Link href="/operations/calendar">View all</Link></header>
        <div className="checklist-scope"><button className="active">My checklists</button><Link href="/operations/calendar">All locations</Link><Link href="/operations/performance">All owners</Link></div>
        <div className="checklist-assigned-list">{checklists?.slice(0, 5).map((checklist) => { const done = checklist.steps.filter((step) => step.complete).length; const progress = checklist.steps.length ? Math.round(done / checklist.steps.length * 100) : 0; return <article key={checklist.id}><input aria-label={`Complete next step for ${checklist.title}`} checked={progress === 100} onChange={() => { const next = checklist.steps.find((step) => !step.complete) ?? checklist.steps.at(-1); if (next) toggleStep(checklist.id, next.id); }} type="checkbox"/><div><strong>{checklist.title}</strong><small>{checklist.location} · {checklist.owner}</small><span><i style={{ width: `${progress}%` }}/></span></div><b>{done}/{checklist.steps.length}</b><time><CalendarDays/> {formatOperationsDate(checklist.dueDate)}</time><MoreVertical/></article>})}</div>
        {!checklists?.length && <p className="checklist-empty-copy">Create the first checklist to begin tracking work.</p>}
        <a className="checklist-panel-link" href="#assigned-checklists"><ListChecks/> View all assigned checklists <ArrowRight/></a>
      </section>
    </div>
    <footer className="checklist-benefits">
      <div><Target/><span><strong>Stay consistent</strong><small>Ensure every location follows the same process.</small></span></div>
      <div><Users/><span><strong>Hold teams accountable</strong><small>Assign owners and track progress in real time.</small></span></div>
      <div><ListChecks/><span><strong>Improve efficiency</strong><small>Identify bottlenecks and keep things moving.</small></span></div>
      <div><Trophy/><span><strong>Drive results</strong><small>Better operations lead to a stronger bottom line.</small></span></div>
    </footer>
  </section>;
}
