"use server";
import { validateWorkspaceLocation } from "@/lib/locations";

import { revalidatePath } from "next/cache";
import { canManageOperations } from "@/lib/auth/permissions";
import { getViewer } from "@/lib/auth/viewer";
import type { ImprovementLevel, ImprovementStatus, ProcessImprovement } from "@/lib/operations/improvements";
import { createClient } from "@/lib/supabase/server";

const dbValue = (value: string) => value.toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
const departments = ["Management", "Sales", "Service", "Administrative", "Delivery"];
const levels: ImprovementLevel[] = ["Low", "Medium", "High", "Critical"];

function refresh(id?: string) {
  ["/operations/improvements", "/operations/improvements/review", "/operations/improvements/dashboard", id ? `/operations/improvements/${id}` : ""].filter(Boolean).forEach((path) => revalidatePath(path));
}

export async function submitImprovement(input: { kind: ProcessImprovement["kind"]; title: string; description: string; department: string; location: string; frequency: ProcessImprovement["frequency"]; impact: ImprovementLevel; urgency: ImprovementLevel }) {
  const viewer = await getViewer();
  const locationError = await validateWorkspaceLocation(input.location); if (locationError) return { error: locationError };
  if (!viewer || viewer.demo) return { error: "Sign in to save an improvement to the shared workspace." };
  if (input.title.trim().length < 2 || input.description.trim().length < 20 || !departments.includes(input.department) || !levels.includes(input.impact) || !levels.includes(input.urgency)) return { error: "Complete the title, description, department, impact, and urgency fields." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("operations_improvements").insert({ organization_id: viewer.organizationId, kind: dbValue(input.kind), title: input.title.trim(), description: input.description.trim(), department: dbValue(input.department), location_name: input.location, frequency: dbValue(input.frequency), impact: dbValue(input.impact), urgency: dbValue(input.urgency), submitted_by: viewer.id }).select("id").single();
  if (error || !data) return { error: error?.message ?? "The improvement could not be submitted." };
  await supabase.from("operations_improvement_status_history").insert({ organization_id: viewer.organizationId, improvement_id: data.id, status: "submitted", decision: "pending", note: "Submission created.", changed_by: viewer.id });
  refresh(data.id);
  return { id: data.id };
}

export type ImprovementWorkflowInput = {
  id: string; decision: ProcessImprovement["managerDecision"]; status: ImprovementStatus; department: string; managerNote: string;
  owner: string; dueDate: string; whys: string[]; correctiveAction: string; results: string; lessonsLearned: string;
  measurement?: { phase: "Before" | "After" | "Follow-up"; metric: string; value: number; unit: string };
};

export async function saveImprovementWorkflow(input: ImprovementWorkflowInput) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || !canManageOperations(viewer.role)) return { error: "Manager access is required to update improvement work." };
  if (!departments.includes(input.department) || input.owner.trim().length < 2) return { error: "Choose a department and assign an owner." };
  const supabase = await createClient();
  const verified = input.status === "Verified" || input.status === "Closed";
  const { error } = await supabase.from("operations_improvements").update({ department: dbValue(input.department), manager_decision: dbValue(input.decision), status: dbValue(input.status), manager_note: input.managerNote.trim(), owner_name: input.owner.trim(), due_date: input.dueDate || null, results: input.results.trim(), lessons_learned: input.lessonsLearned.trim(), reviewed_by: viewer.id, verified_by: verified ? viewer.id : null, verified_at: verified ? new Date().toISOString() : null }).eq("id", input.id).eq("organization_id", viewer.organizationId);
  if (error) return { error: error.message };
  await supabase.from("operations_improvement_status_history").insert({ organization_id: viewer.organizationId, improvement_id: input.id, status: dbValue(input.status), decision: dbValue(input.decision), note: input.managerNote.trim() || "Workflow updated.", changed_by: viewer.id });
  await supabase.from("operations_improvement_whys").delete().eq("improvement_id", input.id).eq("organization_id", viewer.organizationId);
  const whys = input.whys.map((answer, index) => ({ answer: answer.trim(), position: index + 1 })).filter((item) => item.answer.length >= 2);
  if (whys.length) await supabase.from("operations_improvement_whys").insert(whys.map((item) => ({ ...item, organization_id: viewer.organizationId, improvement_id: input.id, created_by: viewer.id })));
  if (input.correctiveAction.trim().length >= 2) {
    const { data: existing } = await supabase.from("operations_improvement_actions").select("id").eq("improvement_id", input.id).eq("organization_id", viewer.organizationId).limit(1).maybeSingle();
    if (existing) await supabase.from("operations_improvement_actions").update({ description: input.correctiveAction.trim(), owner_name: input.owner.trim(), due_date: input.dueDate || null }).eq("id", existing.id);
    else await supabase.from("operations_improvement_actions").insert({ organization_id: viewer.organizationId, improvement_id: input.id, description: input.correctiveAction.trim(), owner_name: input.owner.trim(), due_date: input.dueDate || null, created_by: viewer.id });
  }
  if (input.measurement && input.measurement.metric.trim().length >= 2 && input.measurement.unit.trim()) await supabase.from("operations_improvement_measurements").insert({ organization_id: viewer.organizationId, improvement_id: input.id, phase: dbValue(input.measurement.phase), metric: input.measurement.metric.trim(), value: input.measurement.value, unit: input.measurement.unit.trim(), measured_at: new Date().toISOString().slice(0,10), created_by: viewer.id });
  refresh(input.id);
  return {};
}
