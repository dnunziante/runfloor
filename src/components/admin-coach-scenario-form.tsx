"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Plus, Save } from "lucide-react";
import { createCoachScenario, type CoachScenarioActionState } from "@/app/admin/coach/actions";
import type { CoachScenario } from "@/lib/coach/types";

const initialState: CoachScenarioActionState = { error: "", success: "" };
const defaultWeights = [["Clarify", 20], ["Listen", 20], ["Open", 15], ["Solve", 15], ["Explain", 15], ["Recommend", 15]] as const;

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary" disabled={pending} type="submit">{pending ? <><LoaderCircle className="spin" size={16}/> Saving...</> : editing ? <><Save size={16}/> Save changes</> : <><Plus size={16}/> Add scenario</>}</button>;
}

export function AdminCoachScenarioForm({ demo, scenario, categories = [] }: { demo: boolean; scenario?: CoachScenario; categories?: string[] }) {
  const [state, action] = useActionState(createCoachScenario, initialState);
  const editing = Boolean(scenario);
  const roundPrompt = (roundNumber: number) => scenario?.rounds.find((round) => round.roundNumber === roundNumber)?.customerPrompt || "";
  return <form className="card form-stack" action={action} id="coach-scenario-form">
    {scenario && <input type="hidden" name="scenarioId" value={scenario.id}/>}
    <div><h2>{editing ? "Edit practice scenario" : "Add practice scenario"}</h2><p style={{ fontSize: 12, marginBottom: 0 }}>{editing ? `Update ${scenario?.title}.` : "Scenarios belong only to the active organization."}</p></div>
    {demo && <div className="callout"><strong>Workspace access required</strong><p>Sign in to create or update practice scenarios.</p></div>}
    <div className="grid grid-2"><div><label className="label" htmlFor="coach-title">Title</label><input className="input" id="coach-title" name="title" required defaultValue={scenario?.title} placeholder="Handling a trade-in question"/></div><div><label className="label" htmlFor="coach-category">Category</label>{categories.length ? <select className="input" id="coach-category" name="category" required defaultValue={scenario?.category || categories[0]}>{categories.map((category) => <option key={category}>{category}</option>)}</select> : <input className="input" id="coach-category" name="category" required defaultValue={scenario?.category} placeholder="Discovery"/>}</div></div>
    <div className="grid grid-2"><div><label className="label" htmlFor="coach-difficulty">Difficulty</label><select className="input" id="coach-difficulty" name="difficulty" defaultValue={scenario?.difficulty || "Foundational"}><option>Foundational</option><option>Intermediate</option><option>Advanced</option></select></div><div><label className="label" htmlFor="coach-duration">Duration</label><input className="input" id="coach-duration" name="durationMinutes" type="number" min="1" max="60" defaultValue={scenario?.durationMinutes || 6} required/></div></div>
    <div><label className="label" htmlFor="coach-customer">Customer persona</label><input className="input" id="coach-customer" name="customer" required defaultValue={scenario?.customer} placeholder="A first-time buyer comparing options"/></div>
    <div><label className="label" htmlFor="coach-goal">Practice objective</label><textarea className="input" id="coach-goal" name="goal" rows={3} required defaultValue={scenario?.goal} placeholder="What should the salesperson practice?"/></div>
    <div><label className="label" htmlFor="coach-opening">Customer opening statement</label><textarea className="input" id="coach-opening" name="opening" rows={2} required defaultValue={scenario?.opening} placeholder="What does the customer say first?"/></div>
    <div><label className="label" htmlFor="coach-round-two">Round 2 customer prompt</label><textarea className="input" id="coach-round-two" name="roundTwoPrompt" rows={2} required defaultValue={roundPrompt(2)} placeholder="How does the customer respond after discovery?"/></div>
    <div><label className="label" htmlFor="coach-round-three">Round 3 customer prompt</label><textarea className="input" id="coach-round-three" name="roundThreePrompt" rows={2} required defaultValue={roundPrompt(3)} placeholder="What does the customer say before the next-step recommendation?"/></div>
    <div><label className="label" htmlFor="coach-skills">Skills</label><input className="input" id="coach-skills" name="skills" required defaultValue={scenario?.skills.join(", ")} placeholder="Listen, Clarify, Recommend"/><small className="field-help">Separate skills with commas.</small></div>
    <div><label className="label" htmlFor="coach-tags">Tags</label><input className="input" id="coach-tags" name="tags" defaultValue={scenario?.tags?.join(", ")} placeholder="Trade-In, Negotiation, Experienced Buyer"/><small className="field-help">Separate tags with commas.</small></div>
    <div><label className="label" htmlFor="coach-responses">Response options</label><textarea className="input" id="coach-responses" name="responseOptions" rows={5} required defaultValue={scenario?.responseOptions.join("\n")} placeholder={"Enter one response per line.\nThe first response is treated as preferred for scoring."}/><small className="field-help">Add two to six choices.</small></div>
    <fieldset className="rubric-fields"><legend>C.L.O.S.E.R. scoring weights</legend><div className="grid grid-3">{defaultWeights.map(([skill, weight]) => <div key={skill}><label className="label" htmlFor={`new-weight-${skill}`}>{skill}</label><input className="input" id={`new-weight-${skill}`} name={`weight${skill}`} type="number" min="0" max="100" defaultValue={scenario?.rubricWeights[skill] ?? weight} required/></div>)}</div><small className="field-help">Weights must total 100.</small></fieldset>
    <div><label className="label" htmlFor="coach-status">Status</label><select className="input" id="coach-status" name="status" defaultValue={scenario?.status.toLowerCase() || "draft"}><option value="draft">Draft</option><option value="published">Published</option>{editing && <option value="archived">Archived</option>}</select></div>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}{state.success && <p className="form-success" role="status">{state.success}</p>}
    <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}><SaveButton editing={editing}/>{editing && <Link className="btn btn-ghost" href="/admin/coach">Cancel</Link>}</div>
  </form>;
}
