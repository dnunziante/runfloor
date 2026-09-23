/* eslint-disable @typescript-eslint/no-explicit-any */
import { AdminCoachScenarioManager } from "@/components/admin-coach-scenario-manager";
import { AppShell } from "@/components/app-shell";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { deleteCoachPersonaTemplate, duplicateCoachPersonaTemplate, saveCoachPersonaTemplate, setCoachPersonaTemplateStatus } from "./actions";
import { getScenarioFacets, getScenarioPage } from "./scenario-query";

export default async function AdminCoachPage() {
  const viewer = await getViewer(); const supabase = await createClient();
  const [initialPage,facets,personaResult,categoryResult] = await Promise.all([
    getScenarioPage({category:"All Scenarios",difficulty:"all",tag:"all",status:"all",sort:"updated",query:"",page:1}),
    getScenarioFacets(),
    viewer?.organizationId && !viewer.demo ? supabase.from("coach_persona_templates").select("id,name,archetype,difficulty,is_active,industry").eq("organization_id", viewer.organizationId).order("name") : Promise.resolve({ data: [] }),
    viewer?.organizationId && !viewer.demo ? supabase.from("text_template_categories").select("id,name,position,archived").eq("organization_id",viewer.organizationId).eq("content_group","practice_scenario").order("position").order("name") : Promise.resolve({data:[]}),
  ]);
  const personas = personaResult.data || [], categories=categoryResult.data||[];
  return <AppShell title="Admin · Sales Coach">
    <AdminCoachScenarioManager initialPage={initialPage} facets={facets} categories={categories} canManage={Boolean(viewer&&["tenant_admin","platform_owner"].includes(viewer.role))} demo={Boolean(viewer?.demo)}/>
      {viewer && ["tenant_admin", "platform_owner", "manager"].includes(viewer.role) && <section className="card form-stack"><div><span className="badge blue">Persona library</span><h2>Create a customer persona</h2><p>Set customer boundaries; RunFloor generates the actual conversation.</p></div><form action={saveCoachPersonaTemplate} className="form-stack"><div className="grid grid-2"><input className="input" name="name" required placeholder="Persona name"/><input className="input" name="archetype" required placeholder="Archetype, e.g. Price shopper"/><input className="input" name="industry" defaultValue="General sales" placeholder="Industry"/><select className="input" name="difficulty" defaultValue="Intermediate"><option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option></select><input className="input" name="primaryUse" placeholder="Primary use or need"/><input className="input" name="primaryConcern" placeholder="Primary concern"/></div><input className="input" name="personality" placeholder="Personality / communication style"/><textarea className="input" name="notes" rows={3} placeholder="Optional AI behavior notes"/><button className="btn btn-primary" type="submit">Save persona template</button></form>{personas.length > 0 && <div className="table-wrap"><table className="table"><thead><tr><th>Persona</th><th>Difficulty</th><th>Status</th><th>Action</th></tr></thead><tbody>{personas.map((persona: any) => <tr key={persona.id}><td><strong>{persona.name}</strong><small style={{ display: "block", color: "#68738a" }}>{persona.archetype} · {persona.industry}</small></td><td>{persona.difficulty}</td><td>{persona.is_active ? "Active" : "Inactive"}</td><td><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><form action={setCoachPersonaTemplateStatus}><input type="hidden" name="personaId" value={persona.id}/><input type="hidden" name="active" value={persona.is_active ? "false" : "true"}/><button className="btn btn-ghost" type="submit">{persona.is_active ? "Deactivate" : "Activate"}</button></form><form action={duplicateCoachPersonaTemplate}><input type="hidden" name="personaId" value={persona.id}/><button className="btn btn-ghost" type="submit">Duplicate</button></form><form action={deleteCoachPersonaTemplate}><input type="hidden" name="personaId" value={persona.id}/><button className="btn btn-ghost danger-button" type="submit">Delete</button></form></div></td></tr>)}</tbody></table></div>}</section>}
  </AppShell>;
}
/* eslint-disable @typescript-eslint/no-explicit-any */
