"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Lightbulb, LoaderCircle, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { submitImprovement } from "@/app/operations/improvements/actions";
import type { ImprovementLevel, ProcessImprovement } from "@/lib/operations/improvements";

const departments = ["Management", "Sales", "Service", "Administrative", "Delivery"];

export function ImprovementIntake({ persistence = "demo", tailored = false }: { persistence?: "demo" | "supabase"; tailored?: boolean }) {
  const [kind, setKind] = useState<ProcessImprovement["kind"]>("Problem");
  const [description, setDescription] = useState("");
  const [guidance, setGuidance] = useState<"idle" | "loading" | "ready">("idle");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function guideDescription() { setGuidance("loading"); window.setTimeout(() => setGuidance("ready"), 650); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    if (persistence === "supabase") {
      const form = new FormData(event.currentTarget);
      const result = await submitImprovement({ kind, title: String(form.get("title") ?? ""), description, department: String(form.get("department") ?? ""), location: String(form.get("location") ?? ""), frequency: String(form.get("frequency")) as ProcessImprovement["frequency"], impact: String(form.get("impact")) as ImprovementLevel, urgency: String(form.get("urgency")) as ImprovementLevel });
      if (result.error) { setError(result.error); setSaving(false); return; }
    }
    setSaving(false); setSubmitted(true);
  }

  if (submitted) return <section className="card improvement-success"><CheckCircle2 size={34}/><span className="badge">Submitted</span><h2>Thank you for helping us improve</h2><p>{persistence === "supabase" ? "Your submission was saved and is ready for manager review." : "Your prototype submission is complete but was not saved or sent."}</p><div><Link className="btn btn-primary" href="/operations/improvements">View submissions</Link><button className="btn btn-ghost" onClick={() => setSubmitted(false)}>Submit another</button></div></section>;

  if (tailored) return <form id="share-idea" className="card improvement-intake improvement-intake-tailored" onSubmit={submit}>
    <div className="metric-row"><div><h2>Share an idea or report an issue</h2><p>Quick and easy. Every idea helps us move forward.</p></div><span className="metric-icon"><Lightbulb size={19}/></span></div>
    <label><span className="label">Type</span><select className="input" value={kind} onChange={(event)=>setKind(event.target.value as ProcessImprovement["kind"])}><option>Problem</option><option>Improvement</option></select></label>
    <label><span className="label">Title</span><input className="input" name="title" required placeholder="Short description of your idea or issue"/></label>
    <label><span className="label">Details</span><textarea className="input" required rows={4} value={description} onChange={(event)=>setDescription(event.target.value)} placeholder="Tell us more..."/></label>
    <label><span className="label">Location (optional)</span><select className="input" name="location"><option>Charleston</option><option>Summerville</option><option>All locations</option></select></label>
    <input type="hidden" name="department" value="Management"/><input type="hidden" name="frequency" value="One time"/><input type="hidden" name="impact" value="Medium"/><input type="hidden" name="urgency" value="Medium"/>
    {error&&<p className="form-error">{error}</p>}<button className="btn btn-primary" disabled={saving} type="submit">{saving?<><LoaderCircle className="spin" size={16}/> Saving submission</>:<><Send size={16}/> Submit to team</>}</button>
  </form>;

  return <form className="improvement-intake" onSubmit={submit}>
    <section className="card improvement-kind"><h2>How would you like to help?</h2><div className="improvement-kind-grid"><button className={kind === "Problem" ? "selected" : ""} type="button" onClick={() => setKind("Problem")}><span className="metric-icon"><Lightbulb size={20}/></span><strong>Report a Problem</strong><small>Something is making the work harder, slower, or less reliable.</small></button><button className={kind === "Improvement" ? "selected" : ""} type="button" onClick={() => setKind("Improvement")}><span className="metric-icon"><Sparkles size={20}/></span><strong>Suggest an Improvement</strong><small>You see a simpler or better way to complete the work.</small></button></div></section>
    <section className="card form-stack"><div><span className="badge blue">Step 1</span><h2>Tell us what you noticed</h2></div><label><span className="label">Short title</span><input className="input" name="title" required placeholder={kind === "Problem" ? "Example: Delivery photos need to be retaken" : "Example: Label the most-used parts bins"}/></label><label><span className="label">What is happening, and what should be happening instead?</span><textarea className="input" required rows={6} value={description} onChange={(event) => { setDescription(event.target.value); setGuidance("idle"); }} placeholder="Describe what you saw, when it happens, and how it affects the work."/></label><button className="btn btn-secondary improvement-guide-button" disabled={description.trim().length < 20 || guidance === "loading"} type="button" onClick={guideDescription}>{guidance === "loading" ? <><LoaderCircle className="spin" size={16}/> Reviewing description</> : <><Sparkles size={16}/> Help me describe it clearly</>}</button>{guidance === "ready" && <div className="callout"><Sparkles size={18}/><div><strong>Guided description</strong><p>Add one recent example, who is affected, and the expected result. This guidance is deterministic; OpenAI is not connected.</p></div></div>}</section>
    <section className="card form-stack"><div><span className="badge blue">Step 2</span><h2>Help us understand the impact</h2></div><div className="grid grid-2"><label><span className="label">Department</span><select className="input" name="department" required defaultValue=""><option value="" disabled>Select department</option>{departments.map((item)=><option key={item}>{item}</option>)}</select></label><label><span className="label">Location</span><select className="input" name="location"><option>Charleston</option><option>Summerville</option><option>All locations</option></select></label></div><div className="grid grid-3"><label><span className="label">How often?</span><select className="input" name="frequency"><option>One time</option><option>Occasional</option><option>Weekly</option><option>Daily</option><option>Multiple times daily</option></select></label><label><span className="label">How much does it affect the work?</span><select className="input" name="impact"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label><span className="label">How quickly does it need attention?</span><select className="input" name="urgency"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label></div>{error && <p className="form-error">{error}</p>}<button className="btn btn-primary" disabled={saving} type="submit">{saving ? <><LoaderCircle className="spin" size={16}/> Saving submission</> : <>Send for review <ArrowRight size={16}/></>}</button></section>
  </form>;
}
