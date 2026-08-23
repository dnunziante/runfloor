"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { isLocalDemoMode } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type CoachScenarioActionState = { error: string; success: string };

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function requireTenantAdmin() {
  const viewer = await getViewer();
  if (!viewer?.organizationId || !["tenant_admin", "platform_owner"].includes(viewer.role)) throw new Error("Unauthorized");
  return viewer;
}

async function requirePersonaManager() {
  const viewer = await getViewer();
  if (!viewer?.organizationId || !["tenant_admin", "platform_owner", "manager"].includes(viewer.role)) throw new Error("Unauthorized");
  return viewer;
}

export async function saveCoachPersonaTemplate(formData: FormData) {
  if (isLocalDemoMode()) throw new Error("Persona editing is disabled in local demo mode.");
  const viewer = await requirePersonaManager();
  const id = String(formData.get("personaId") || ""); const name = String(formData.get("name") || "").trim(); const archetype = String(formData.get("archetype") || "").trim(); const difficulty = String(formData.get("difficulty") || "Intermediate"); const notes = String(formData.get("notes") || "").trim();
  if (name.length < 2 || archetype.length < 2 || !["Beginner", "Intermediate", "Advanced", "Expert"].includes(difficulty)) throw new Error("Enter a name, archetype, and valid difficulty.");
  const supabase = await createClient(); const values = { organization_id: viewer.organizationId, name, archetype, industry: String(formData.get("industry") || "General sales").trim() || "General sales", difficulty, notes, configuration: { primaryUse: String(formData.get("primaryUse") || "").trim(), primaryConcern: String(formData.get("primaryConcern") || "").trim(), personality: String(formData.get("personality") || "").trim() }, updated_at: new Date().toISOString() };
  const result = id ? await supabase.from("coach_persona_templates").update(values).eq("id", id).eq("organization_id", viewer.organizationId) : await supabase.from("coach_persona_templates").insert({ ...values, created_by: viewer.id });
  if (result.error) throw new Error("The persona template could not be saved."); revalidatePath("/admin/coach"); revalidatePath("/coach/session");
}

export async function setCoachPersonaTemplateStatus(formData: FormData) {
  const viewer = await requirePersonaManager(); const id = String(formData.get("personaId") || ""); const active = formData.get("active") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid persona template."); const supabase = await createClient(); const { error } = await supabase.from("coach_persona_templates").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", viewer.organizationId); if (error) throw new Error("The persona template could not be updated."); revalidatePath("/admin/coach"); revalidatePath("/coach/session");
}

export async function duplicateCoachPersonaTemplate(formData: FormData) {
  const viewer = await requirePersonaManager(); const id = String(formData.get("personaId") || ""); if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid persona template.");
  const supabase = await createClient(); const { data: source, error } = await supabase.from("coach_persona_templates").select("name,archetype,industry,difficulty,configuration,notes,location_id,applicable_product_ids,applicable_competitor_ids").eq("id", id).eq("organization_id", viewer.organizationId).single(); if (error || !source) throw new Error("The persona template could not be copied.");
  const result = await supabase.from("coach_persona_templates").insert({ ...source, organization_id: viewer.organizationId, name: `${source.name} copy`.slice(0, 120), created_by: viewer.id, is_active: false }); if (result.error) throw new Error("The persona template could not be copied."); revalidatePath("/admin/coach");
}

export async function deleteCoachPersonaTemplate(formData: FormData) {
  const viewer = await requirePersonaManager(); const id = String(formData.get("personaId") || ""); if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid persona template."); const supabase = await createClient(); const { error } = await supabase.from("coach_persona_templates").delete().eq("id", id).eq("organization_id", viewer.organizationId); if (error) throw new Error("The persona template could not be deleted."); revalidatePath("/admin/coach"); revalidatePath("/coach/session");
}

export async function createCoachScenario(_previousState: CoachScenarioActionState, formData: FormData): Promise<CoachScenarioActionState> {
  if (isLocalDemoMode()) return { error: "Scenario editing is disabled in local demo mode. Sign in to the connected workspace to save changes.", success: "" };
  const viewer = await requireTenantAdmin();
  const scenarioId = String(formData.get("scenarioId") || "");
  const isEditing = scenarioId.length > 0;
  if (isEditing && !/^[0-9a-f-]{36}$/i.test(scenarioId)) return { error: "The selected scenario is invalid.", success: "" };
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const difficulty = String(formData.get("difficulty") || "Foundational");
  const durationMinutes = Number(formData.get("durationMinutes"));
  const customer = String(formData.get("customer") || "").trim();
  const goal = String(formData.get("goal") || "").trim();
  const opening = String(formData.get("opening") || "").trim();
  const roundTwoPrompt = String(formData.get("roundTwoPrompt") || "").trim();
  const roundThreePrompt = String(formData.get("roundThreePrompt") || "").trim();
  const status = formData.get("status") === "published" ? "published" : "draft";
  const skills = String(formData.get("skills") || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8);
  const responseOptions = String(formData.get("responseOptions") || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 6);
  const rubricWeights = Object.fromEntries(["Clarify", "Listen", "Open", "Solve", "Explain", "Recommend"].map((skill) => [skill, Number(formData.get(`weight${skill}`))]));
  const weightTotal = Object.values(rubricWeights).reduce((total, value) => total + value, 0);

  if (title.length < 2 || category.length < 2 || customer.length < 2 || goal.length < 2 || opening.length < 2 || roundTwoPrompt.length < 2 || roundThreePrompt.length < 2) {
    return { error: "Complete the title, customer, objective, and all three customer prompts.", success: "" };
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 60 || skills.length < 1 || responseOptions.length < 2) {
    return { error: "Add a valid duration, at least one skill, and at least two response options.", success: "" };
  }
  if (Object.values(rubricWeights).some((value) => !Number.isInteger(value) || value < 0 || value > 100) || weightTotal !== 100) return { error: "C.L.O.S.E.R. weights must be whole numbers totaling 100.", success: "" };

  const supabase = await createClient();
  const scenarioValues = {
    organization_id: viewer.organizationId,
    slug: slugify(title),
    title,
    category,
    difficulty,
    duration_minutes: durationMinutes,
    customer_persona: customer,
    goal,
    opening,
    skills,
    response_options: responseOptions,
    preferred_option_indices: [0],
    rubric_weights: rubricWeights,
    status,
    updated_at: new Date().toISOString(),
  };
  const scenarioQuery = isEditing
    ? supabase.from("coach_scenarios").update(scenarioValues).eq("id", scenarioId).eq("organization_id", viewer.organizationId)
    : supabase.from("coach_scenarios").insert({ ...scenarioValues, created_by: viewer.id });
  const { data: scenario, error } = await scenarioQuery.select("id").single();

  if (error || !scenario) return { error: error?.code === "23505" ? "A scenario with that title already exists." : `The scenario could not be ${isEditing ? "updated" : "saved"}.`, success: "" };
  const roundValues = [
    { organization_id: viewer.organizationId, scenario_id: scenario.id, round_number: 1, customer_prompt: opening, response_options: responseOptions, preferred_option_indices: [0], skill_impacts: ["Clarify", "Listen"] },
    { organization_id: viewer.organizationId, scenario_id: scenario.id, round_number: 2, customer_prompt: roundTwoPrompt, response_options: responseOptions, preferred_option_indices: [0], skill_impacts: ["Open", "Solve", "Explain"] },
    { organization_id: viewer.organizationId, scenario_id: scenario.id, round_number: 3, customer_prompt: roundThreePrompt, response_options: responseOptions, preferred_option_indices: [0], skill_impacts: ["Explain", "Recommend"] },
  ];
  const { error: roundsError } = isEditing
    ? await supabase.from("coach_scenario_rounds").upsert(roundValues, { onConflict: "scenario_id,round_number" })
    : await supabase.from("coach_scenario_rounds").insert(roundValues);
  if (roundsError) {
    if (!isEditing) await supabase.from("coach_scenarios").delete().eq("id", scenario.id).eq("organization_id", viewer.organizationId);
    return { error: `The scenario rounds could not be ${isEditing ? "updated" : "saved"}.`, success: "" };
  }
  revalidatePath("/coach");
  revalidatePath("/coach/scenarios");
  revalidatePath("/admin/coach");
  return { error: "", success: `${title} was ${isEditing ? "updated" : "saved"}.` };
}

export async function updateCoachScenarioRubric(_previousState: CoachScenarioActionState, formData: FormData): Promise<CoachScenarioActionState> {
  if (isLocalDemoMode()) return { error: "Rubric editing is disabled in local demo mode.", success: "" };
  const viewer = await requireTenantAdmin();
  const scenarioId = String(formData.get("scenarioId") || "");
  const weights = Object.fromEntries(["Clarify", "Listen", "Open", "Solve", "Explain", "Recommend"].map((skill) => [skill, Number(formData.get(`weight${skill}`))]));
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (!/^[0-9a-f-]{36}$/i.test(scenarioId) || Object.values(weights).some((value) => !Number.isInteger(value) || value < 0 || value > 100) || total !== 100) return { error: "Choose a scenario and enter whole-number weights totaling 100.", success: "" };

  const supabase = await createClient();
  const { error } = await supabase.from("coach_scenarios").update({ rubric_weights: weights, updated_at: new Date().toISOString() }).eq("id", scenarioId).eq("organization_id", viewer.organizationId);
  if (error) return { error: "The scoring rubric could not be updated.", success: "" };
  revalidatePath("/admin/coach");
  return { error: "", success: "Scoring weights were updated." };
}

export async function updateCoachScenarioStatus(formData: FormData) {
  if (isLocalDemoMode()) throw new Error("Scenario editing is disabled in local demo mode.");
  const viewer = await requireTenantAdmin();
  const scenarioId = String(formData.get("scenarioId") || "");
  const status = String(formData.get("status") || "");
  if (!/^[0-9a-f-]{36}$/i.test(scenarioId) || !["draft", "published", "archived"].includes(status)) throw new Error("Invalid scenario update");

  const supabase = await createClient();
  const { error } = await supabase.from("coach_scenarios").update({ status, updated_at: new Date().toISOString() }).eq("id", scenarioId).eq("organization_id", viewer.organizationId);
  if (error) throw new Error("The scenario status could not be updated.");
  revalidatePath("/coach");
  revalidatePath("/coach/scenarios");
  revalidatePath("/admin/coach");
}
