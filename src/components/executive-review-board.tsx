"use client";

import { CheckCircle2, ClipboardCheck, Save, UserRound } from "lucide-react";
import { useState } from "react";
import { saveExecutivePriorityReview } from "@/app/executive/actions";
import type { ExecutivePriority, ExecutivePriorityReview, ExecutivePriorityReviewStatus } from "@/lib/executive/data";

const labels: Record<ExecutivePriorityReviewStatus, string> = { open: "Open", acknowledged: "Acknowledged", in_progress: "In progress", completed: "Completed", dismissed: "Dismissed" };

function PriorityReview({ priority, initialReview, period, persistence }: { priority: ExecutivePriority; initialReview?: ExecutivePriorityReview; period: string; persistence: "demo" | "supabase" }) {
  const [review, setReview] = useState(initialReview);
  const [status, setStatus] = useState<ExecutivePriorityReviewStatus>(initialReview?.status ?? "open");
  const [ownerName, setOwnerName] = useState(initialReview?.ownerName ?? "");
  const [dueDate, setDueDate] = useState(initialReview?.dueDate ?? "");
  const [reviewNote, setReviewNote] = useState(initialReview?.reviewNote ?? "");
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(""); setNotice(""); const result = await saveExecutivePriorityReview({ priorityKey: priority.id, reportingPeriod: period, status, ownerName, dueDate, reviewNote }); setSaving(false); if (result.error) setError(result.error); else if (result.review) { setReview(result.review); setNotice(persistence === "demo" ? "Review updated for this view." : "Priority review saved for this organization."); } }
  return <article className="executive-review-item"><div className="executive-review-summary"><div><span className={`badge ${status === "completed" ? "" : status === "in_progress" ? "amber" : "blue"}`}>{labels[status]}</span><h3>{priority.title}</h3><p>{review?.ownerName ? `${review.ownerName}${review.dueDate ? ` · Due ${new Date(`${review.dueDate}T12:00:00`).toLocaleDateString()}` : ""}` : "No owner assigned"}</p></div><span className="executive-rank">{priority.rank}</span></div><details><summary>Review and assign</summary><form className="form-stack" onSubmit={submit}><div className="grid grid-2"><label><span className="label">Status</span><select className="input" value={status} onChange={(event) => setStatus(event.target.value as ExecutivePriorityReviewStatus)}>{Object.entries(labels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="label">Owner</span><input className="input" maxLength={160} placeholder="Manager or team" value={ownerName} onChange={(event) => setOwnerName(event.target.value)}/></label></div><label><span className="label">Due date</span><input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label><label><span className="label">Manager review note</span><textarea className="input" maxLength={2000} rows={3} placeholder="Decision, context, or follow-up needed" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)}/></label>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="improvement-saved"><CheckCircle2 size={15}/>{notice}</p>}<button className="btn btn-primary" type="submit" disabled={saving}><Save size={16}/>{saving ? "Saving…" : "Save review"}</button></form></details></article>;
}

export function ExecutiveReviewBoard({ priorities, reviews, period, persistence }: { priorities: ExecutivePriority[]; reviews: Record<string, ExecutivePriorityReview>; period: string; persistence: "demo" | "supabase" }) {
  return <section className="card executive-review-board"><div className="section-heading"><div><span className="badge blue"><ClipboardCheck size={13}/> Manager workflow</span><h2>Priority ownership and review</h2><p>Acknowledgements, owners, dates, and notes are saved alongside the calculated priorities.</p></div><UserRound size={22}/></div>{priorities.length ? <div className="executive-review-list">{priorities.map((priority) => <PriorityReview initialReview={reviews[priority.id]} key={priority.id} period={period} persistence={persistence} priority={priority}/>)}</div> : <div className="output empty"><CheckCircle2 size={28}/><h3>No active priorities to review</h3><p>Reviews appear when a connected measure creates an Executive priority.</p></div>}</section>;
}
