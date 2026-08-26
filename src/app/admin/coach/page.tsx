/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { Archive, CheckCircle2, Pencil } from "lucide-react";
import { AdminCoachRubricForm } from "@/components/admin-coach-rubric-form";
import { AdminCoachScenarioForm } from "@/components/admin-coach-scenario-form";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { getCoachScenarios } from "@/lib/coach/data";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { deleteCoachPersonaTemplate, duplicateCoachPersonaTemplate, saveCoachPersonaTemplate, setCoachPersonaTemplateStatus, updateCoachScenarioStatus } from "./actions";

export default async function AdminCoachPage({ searchParams }: { searchParams: Promise<{ edit?: string | string[] }> }) {
  const result = await getCoachScenarios({ includeDrafts: true });
  const requestedEdit = (await searchParams).edit;
  const editId = Array.isArray(requestedEdit) ? requestedEdit[0] : requestedEdit;
  const editingScenario = result.source === "demo" ? undefined : result.scenarios.find((scenario) => scenario.id === editId);
  const viewer = await getViewer(); const supabase = await createClient(); const personaResult = viewer?.organizationId && !viewer.demo ? await supabase.from("coach_persona_templates").select("id,name,archetype,difficulty,is_active,industry").eq("organization_id", viewer.organizationId).order("name") : { data: [] }; const personas = personaResult.data || [];
  return <AppShell title="Admin · Sales Coach">
    <PageHeader eyebrow="Tenant coaching content" title="Practice scenarios" description="Create multi-round practice and configure transparent C.L.O.S.E.R. scoring for this workspace. Platform methodology remains separately controlled."/>
    {result.error && <div className="card error-card"><h2>Scenarios unavailable</h2><p>{result.error}</p></div>}
    <div className="admin-coach-layout">
      <AdminCoachScenarioForm key={editingScenario?.id || "new"} demo={result.source === "demo"} scenario={editingScenario}/>
      <div className="coach-admin-stack">
        {result.scenarios.length > 0 && <AdminCoachRubricForm scenarios={result.scenarios} demo={result.source === "demo"}/>}
        <section className="card"><div className="metric-row"><h2>Workspace scenarios</h2><span className="badge blue">{result.scenarios.length} total</span></div>
          {result.scenarios.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Scenario</th><th>Rounds</th><th>Status</th><th>Action</th></tr></thead><tbody>{result.scenarios.map((scenario) => <tr key={scenario.id}><td><strong>{scenario.title}</strong><small style={{ display: "block", color: "#68738a" }}>{scenario.category} · {scenario.difficulty}</small></td><td>{scenario.rounds.length}</td><td><span className={`badge ${scenario.status === "Draft" ? "amber" : scenario.status === "Archived" ? "" : "blue"}`}>{scenario.status}</span></td><td>{result.source === "demo" ? <small>Preview only</small> : <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Link className="btn btn-ghost" href={`/admin/coach?edit=${scenario.id}#coach-scenario-form`}><Pencil size={14}/> Edit</Link><form action={updateCoachScenarioStatus}><input type="hidden" name="scenarioId" value={scenario.id}/><input type="hidden" name="status" value={scenario.status === "Published" ? "archived" : "published"}/><button className="btn btn-ghost danger-button" type="submit">{scenario.status === "Published" ? <><Archive size={14}/> Archive</> : <><CheckCircle2 size={14}/> Publish</>}</button></form></div>}</td></tr>)}</tbody></table></div> : <div className="output empty"><div><h3>No scenarios yet</h3><p>Add the first multi-round practice scenario for this organization.</p></div></div>}
        </section>
      </div>
      </div>
      {viewer && ["tenant_admin", "platform_owner", "manager"].includes(viewer.role) && <section className="card form-stack"><div><span className="badge blue">Persona library</span><h2>Create a customer persona</h2><p>Set customer boundaries; RunFloor generates the actual conversation.</p></div><form action={saveCoachPersonaTemplate} className="form-stack"><div className="grid grid-2"><input className="input" name="name" required placeholder="Persona name"/><input className="input" name="archetype" required placeholder="Archetype, e.g. Price shopper"/><input className="input" name="industry" defaultValue="General sales" placeholder="Industry"/><select className="input" name="difficulty" defaultValue="Intermediate"><option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option></select><input className="input" name="primaryUse" placeholder="Primary use or need"/><input className="input" name="primaryConcern" placeholder="Primary concern"/></div><input className="input" name="personality" placeholder="Personality / communication style"/><textarea className="input" name="notes" rows={3} placeholder="Optional AI behavior notes"/><button className="btn btn-primary" type="submit">Save persona template</button></form>{personas.length > 0 && <div className="table-wrap"><table className="table"><thead><tr><th>Persona</th><th>Difficulty</th><th>Status</th><th>Action</th></tr></thead><tbody>{personas.map((persona: any) => <tr key={persona.id}><td><strong>{persona.name}</strong><small style={{ display: "block", color: "#68738a" }}>{persona.archetype} · {persona.industry}</small></td><td>{persona.difficulty}</td><td>{persona.is_active ? "Active" : "Inactive"}</td><td><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><form action={setCoachPersonaTemplateStatus}><input type="hidden" name="personaId" value={persona.id}/><input type="hidden" name="active" value={persona.is_active ? "false" : "true"}/><button className="btn btn-ghost" type="submit">{persona.is_active ? "Deactivate" : "Activate"}</button></form><form action={duplicateCoachPersonaTemplate}><input type="hidden" name="personaId" value={persona.id}/><button className="btn btn-ghost" type="submit">Duplicate</button></form><form action={deleteCoachPersonaTemplate}><input type="hidden" name="personaId" value={persona.id}/><button className="btn btn-ghost danger-button" type="submit">Delete</button></form></div></td></tr>)}</tbody></table></div>}</section>}
  </AppShell>;
}
/* eslint-disable @typescript-eslint/no-explicit-any */
