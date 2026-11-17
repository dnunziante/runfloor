"use client";

import { CheckCircle2, Save } from "lucide-react";
import { useState } from "react";
import { saveExecutiveTargets } from "@/app/admin/executive/actions";
import type { ExecutiveTargets } from "@/lib/executive/data";

const fields = [
  ["salesPace", "Sales pace target", "1–200", "Reserved until approved sales results are connected."],
  ["coachingCompletion", "Coaching completion", "1–100", "Completed coaching sessions as a percentage of recorded sessions."],
  ["growthCompletion", "Growth task completion", "1–100", "Completed tasks as a percentage of persisted growth-plan tasks."],
  ["operationsCompletion", "Operations completion", "1–100", "Completed steps as a percentage of persisted checklist steps."],
  ["highRiskLimit", "Open high-risk limit", "0–100", "The number of open high or critical alerts allowed before an Act now priority appears."],
] as const;

export function ExecutiveTargetEditor({ initialTargets, persistence }: { initialTargets: ExecutiveTargets; persistence: "demo" | "supabase" }) {
  const [targets, setTargets] = useState(initialTargets);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    if (persistence === "demo") { setNotice("Targets updated for this prototype view only. Sign in to save organization targets."); setSaving(false); return; }
    const result = await saveExecutiveTargets(targets); setSaving(false); if (result.error) setError(result.error); else setNotice("Executive targets saved for this organization.");
  }
  return <form className="card executive-target-editor" onSubmit={submit}><div className="metric-row"><div><span className="badge blue">Workspace configuration</span><h2>Leadership targets</h2></div><Save size={20}/></div><p>These thresholds control the scorecard and calculated leadership priorities. They do not alter source records.</p><div className="executive-target-grid">{fields.map(([key, label, range, help]) => <label key={key}><span className="label">{label} <small>{range}</small></span><input className="input" type="number" min={key === "highRiskLimit" ? 0 : 1} max={key === "salesPace" ? 200 : 100} required value={targets[key]} onChange={(event) => setTargets((current) => ({ ...current, [key]: Number(event.target.value) }))}/><small className="field-help">{help}</small></label>)}</div>{error && <p className="form-error">{error}</p>}{notice && <p className="improvement-saved"><CheckCircle2 size={15}/>{notice}</p>}<button className="btn btn-primary" type="submit" disabled={saving}><Save size={16}/>{saving ? "Saving targets…" : "Save executive targets"}</button></form>;
}
