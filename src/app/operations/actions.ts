"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { canManageOperations } from "@/lib/auth/permissions";
import type { OperationsAlertRecord, OperationsChecklistRecord, OperationsHandoffRecord, OperationsIncidentRecord, OperationsProcedureRecord, OperationsScheduleRecord } from "@/lib/operations/data";
import type { OperationsProcedureCategory } from "@/lib/operations/data";
import { getNextScheduleDate } from "@/lib/operations/schedules";
import { createClient } from "@/lib/supabase/server";
import { extractDocumentPages } from "@/lib/rag/chunking";
import { createGeneratedChecklist, createRevisedProcedure } from "@/lib/rag/openai";

const dbValue = (value: string) => value.toLowerCase().replaceAll(" ", "_");
async function context() { const viewer = await getViewer(); if (!viewer || viewer.demo) return null; return { viewer, supabase: await createClient() }; }
async function managerContext() { const ctx = await context(); return ctx && canManageOperations(ctx.viewer.role) ? ctx : null; }
function refreshOperations() { ["/operations", "/operations/checklists", "/operations/procedures", "/operations/alerts", "/operations/schedules", "/operations/calendar", "/operations/performance", "/operations/handoffs", "/operations/incidents"].forEach((path) => revalidatePath(path)); }

export type ChecklistSectionInput = { title: string; steps: string[] };
export type GeneratedChecklistInput = { title: string; location: string; owner: string; dueDate: string; sections: ChecklistSectionInput[] };
export async function saveOperationsChecklist(input: Omit<OperationsChecklistRecord, "id" | "createdAt"> & { sections?: ChecklistSectionInput[]; creationSource?: "manual" | "document" }) {
  const ctx = await context(); if (!ctx) return { error: "Sign in to save shared Operations work." };
  if (input.title.trim().length < 2 || input.owner.trim().length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) || !input.steps.length) return { error: "Add a title, owner, due date, and at least one step." };
  const { data, error } = await ctx.supabase.from("operations_checklists").insert({ organization_id: ctx.viewer.organizationId, title: input.title.trim(), location_name: input.location, owner: input.owner.trim(), due_date: input.dueDate, created_by: ctx.viewer.id, creation_source: input.creationSource ?? "manual" }).select("id,created_at").single();
  if (error || !data) return { error: error?.message ?? "Checklist could not be created." };
  const sections = input.sections?.filter((section) => section.title.trim() && section.steps.length) ?? [];
  const { data: sectionRows, error: sectionError } = sections.length ? await ctx.supabase.from("operations_checklist_sections").insert(sections.map((section, position) => ({ organization_id: ctx.viewer.organizationId, checklist_id: data.id, title: section.title.trim(), position }))).select("id,title,position") : { data: [], error: null };
  if (sectionError) { await ctx.supabase.from("operations_checklists").delete().eq("id", data.id); return { error: sectionError.message }; }
  const entries = sections.length ? sections.flatMap((section, sectionIndex) => section.steps.map((title, stepIndex) => ({ organization_id: ctx.viewer.organizationId, checklist_id: data.id, section_id: sectionRows?.[sectionIndex]?.id ?? null, title: title.trim(), position: sectionIndex * 100 + stepIndex }))) : input.steps.map((step, index) => ({ organization_id: ctx.viewer.organizationId, checklist_id: data.id, section_id: null, title: step.title.trim(), position: index }));
  const { data: steps, error: stepError } = await ctx.supabase.from("operations_checklist_steps").insert(entries).select("id,title,is_complete,position");
  if (stepError) { await ctx.supabase.from("operations_checklists").delete().eq("id", data.id); return { error: stepError.message }; }
  refreshOperations(); return { record: { ...input, id: data.id, createdAt: data.created_at, steps: (steps ?? []).sort((a, b) => a.position - b.position).map((step) => ({ id: step.id, title: step.title, complete: step.is_complete })) } };
}

export async function toggleOperationsChecklistStep(checklistId: string, stepId: string, complete: boolean) {
  const ctx = await context(); if (!ctx) return { error: "Sign in to update shared Operations work." };
  const { error } = await ctx.supabase.from("operations_checklist_steps").update({ is_complete: complete, completed_by: complete ? ctx.viewer.id : null, completed_at: complete ? new Date().toISOString() : null }).eq("id", stepId).eq("checklist_id", checklistId).eq("organization_id", ctx.viewer.organizationId);
  if (error) return { error: error.message };
  const { data: steps } = await ctx.supabase.from("operations_checklist_steps").select("is_complete").eq("checklist_id", checklistId).eq("organization_id", ctx.viewer.organizationId);
  const done = steps?.filter((step) => step.is_complete).length ?? 0; const status = done === steps?.length ? "complete" : done ? "in_progress" : "not_started";
  await ctx.supabase.from("operations_checklists").update({ status }).eq("id", checklistId).eq("organization_id", ctx.viewer.organizationId); refreshOperations(); return {};
}

export async function saveOperationsProcedure(input: OperationsProcedureRecord) {
  const ctx = await managerContext(); if (!ctx) return { error: "Manager access is required to manage procedures." };
  if (input.title.trim().length < 2 || input.owner.trim().length < 2 || input.summary.trim().length < 10 || !input.steps.length) return { error: "Complete the procedure details and steps." };
  const existing = !input.id.startsWith("new-");
  const { data: category, error: categoryError } = await ctx.supabase.from("operations_procedure_categories").select("id,name").eq("id", input.categoryId).eq("organization_id", ctx.viewer.organizationId).single();
  if (categoryError || !category) return { error: "Choose a valid procedure category." };
  const query = existing ? ctx.supabase.from("operations_procedures").update({ title: input.title.trim(), category_id: category.id, category: category.name, owner: input.owner.trim(), summary: input.summary.trim(), status: dbValue(input.status), version: input.version }).eq("id", input.id).eq("organization_id", ctx.viewer.organizationId) : ctx.supabase.from("operations_procedures").insert({ organization_id: ctx.viewer.organizationId, title: input.title.trim(), category_id: category.id, category: category.name, owner: input.owner.trim(), summary: input.summary.trim(), status: dbValue(input.status), version: 1, created_by: ctx.viewer.id });
  const { data, error } = await query.select("id,title,category_id,category,owner,summary,status,version,updated_at").single(); if (error || !data) return { error: error?.message ?? "Procedure could not be saved." };
  if (existing) await ctx.supabase.from("operations_procedure_steps").delete().eq("procedure_id", data.id).eq("organization_id", ctx.viewer.organizationId);
  const { error: stepError } = await ctx.supabase.from("operations_procedure_steps").insert(input.steps.map((title, position) => ({ organization_id: ctx.viewer.organizationId, procedure_id: data.id, title, position })));
  if (stepError) return { error: stepError.message }; refreshOperations(); return { record: { ...input, id: data.id, categoryId: data.category_id, category: data.category, version: data.version, updatedAt: data.updated_at } };
}

export async function saveOperationsProcedureCategory(input: { id?: string; name: string }) {
  const ctx = await managerContext(); if (!ctx) return { error: "Manager access is required to manage categories." };
  const name = input.name.trim(); if (name.length < 2 || name.length > 80) return { error: "Category names must be 2–80 characters." };
  const query = input.id ? ctx.supabase.from("operations_procedure_categories").update({ name }).eq("id", input.id).eq("organization_id", ctx.viewer.organizationId).eq("is_default", false) : ctx.supabase.from("operations_procedure_categories").insert({ organization_id: ctx.viewer.organizationId, name, is_default: false });
  const { data, error } = await query.select("id,name,is_default").single(); if (error || !data) return { error: error?.code === "23505" ? "This category already exists." : error?.message ?? "Category could not be saved." };
  refreshOperations(); return { record: { id: data.id, name: data.name, isDefault: data.is_default } as OperationsProcedureCategory };
}

export async function deleteOperationsProcedureCategory(categoryId: string) {
  const ctx = await managerContext(); if (!ctx) return { error: "Manager access is required to manage categories." };
  if (!/^[0-9a-f-]{36}$/i.test(categoryId)) return { error: "Invalid category." };
  const { error } = await ctx.supabase.from("operations_procedure_categories").delete().eq("id", categoryId).eq("organization_id", ctx.viewer.organizationId).eq("is_default", false);
  if (error) return { error: error.code === "23503" ? "Move the procedures in this category before deleting it." : error.message };
  refreshOperations(); return {};
}

export async function generateChecklistFromDocument(formData: FormData) {
  const ctx = await managerContext(); if (!ctx) return { error: "Manager access is required to generate checklists." };
  const file = formData.get("file"); if (!(file instanceof File) || !file.size) return { error: "Choose a PDF, DOCX, Markdown, or text document." }; if (file.size > 4 * 1024 * 1024) return { error: "Document must be 4 MB or smaller." };
  try { const pages = await extractDocumentPages(file); const sourceText = pages.map((page) => page.text).join("\n").trim().slice(0, 80_000); if (sourceText.length < 80) return { error: "No readable operational text was found." }; return { draft: await createGeneratedChecklist({ sourceName: file.name, sourceText, instruction: String(formData.get("instruction") || "") }) }; } catch (error) { return { error: error instanceof Error ? error.message : "Checklist generation failed." }; }
}

export async function approveGeneratedOperationsChecklist(input: GeneratedChecklistInput) {
  const flattened = input.sections.flatMap((section) => section.steps).map((title) => ({ id: "", title, complete: false }));
  return saveOperationsChecklist({ title: input.title, location: input.location, owner: input.owner, dueDate: input.dueDate, steps: flattened, sections: input.sections, creationSource: "document" });
}

export async function deleteOperationsProcedure(procedureId: string) {
  const ctx = await managerContext(); if (!ctx) return { error: "Manager access is required to delete procedures." };
  if (!/^[0-9a-f-]{36}$/i.test(procedureId)) return { error: "Invalid procedure." };
  const { error } = await ctx.supabase.from("operations_procedures").delete().eq("id", procedureId).eq("organization_id", ctx.viewer.organizationId);
  if (error) return { error: error.code === "23503" ? "This procedure is used by a schedule or checklist and cannot be deleted yet." : error.message };
  refreshOperations(); return {};
}

export async function createRevisedOperationsProcedure(formData: FormData) {
  const ctx = await managerContext(); if (!ctx) return { error: "Manager access is required to create procedures." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF, DOCX, Markdown, or text document." };
  if (file.size > 4 * 1024 * 1024) return { error: "Document must be 4 MB or smaller." };
  try {
    const pages = await extractDocumentPages(file); const sourceText = pages.map((page) => page.text).join("\n").trim().slice(0, 80_000);
    if (sourceText.length < 80) return { error: "No readable procedure text was found in this document." };
    const draft = await createRevisedProcedure({ sourceName: file.name, sourceText });
    const { data: namedCategory } = await ctx.supabase.from("operations_procedure_categories").select("id").eq("organization_id", ctx.viewer.organizationId).eq("name", draft.category).single();
    const fallbackCategory = namedCategory ?? (await ctx.supabase.from("operations_procedure_categories").select("id").eq("organization_id", ctx.viewer.organizationId).eq("name", "Uncategorized").single()).data;
    if (!fallbackCategory) return { error: "Procedure categories are not available for this organization." };
    const created = await saveOperationsProcedure({ id: `new-${crypto.randomUUID()}`, ...draft, categoryId: fallbackCategory.id, status: "Draft", version: 1, updatedAt: new Date().toISOString() });
    if (created.error || !created.record) return { error: created.error ?? "The revised procedure could not be saved." };
    return { record: created.record };
  } catch (error) { return { error: error instanceof Error ? error.message : "The document could not be revised." }; }
}

export async function saveOperationsAlert(input: Omit<OperationsAlertRecord, "id" | "createdAt" | "history" | "status">) {
  const ctx = await context(); if (!ctx) return { error: "Sign in to save shared alerts." };
  const { data, error } = await ctx.supabase.from("operations_alerts").insert({ organization_id: ctx.viewer.organizationId, title: input.title.trim(), detail: input.detail.trim(), severity: dbValue(input.severity), location_name: input.location, owner: input.owner.trim(), due_date: input.dueDate, created_by: ctx.viewer.id }).select("id,created_at").single(); if (error || !data) return { error: error?.message ?? "Alert could not be created." };
  const { data: history } = await ctx.supabase.from("operations_alert_history").insert({ organization_id: ctx.viewer.organizationId, alert_id: data.id, status: "open", note: "Alert created.", changed_by: ctx.viewer.id }).select("id,created_at").single(); refreshOperations();
  return { record: { ...input, id: data.id, status: "Open" as const, createdAt: data.created_at, history: history ? [{ id: history.id, status: "Open" as const, note: "Alert created.", changedAt: history.created_at }] : [] } };
}

export async function setOperationsAlertStatus(alertId: string, status: OperationsAlertRecord["status"], note: string) {
  const ctx = await context(); if (!ctx) return { error: "Sign in to update shared alerts." }; const value = dbValue(status);
  const { error } = await ctx.supabase.from("operations_alerts").update({ status: value }).eq("id", alertId).eq("organization_id", ctx.viewer.organizationId); if (error) return { error: error.message };
  const { data, error: historyError } = await ctx.supabase.from("operations_alert_history").insert({ organization_id: ctx.viewer.organizationId, alert_id: alertId, status: value, note, changed_by: ctx.viewer.id }).select("id,created_at").single(); if (historyError || !data) return { error: historyError?.message ?? "Alert history could not be saved." }; refreshOperations(); return { history: { id: data.id, status, note, changedAt: data.created_at } };
}

export async function saveOperationsSchedule(input: Omit<OperationsScheduleRecord, "id" | "createdAt" | "lastGeneratedAt" | "status">) {
  const ctx = await managerContext(); if (!ctx) return { error: "Manager access is required to manage schedules." };
  const { data, error } = await ctx.supabase.from("operations_schedules").insert({ organization_id: ctx.viewer.organizationId, procedure_id: input.procedureId, frequency: dbValue(input.frequency), location_name: input.location, owner: input.owner.trim(), next_run_date: input.nextRunDate, created_by: ctx.viewer.id }).select("id,created_at").single(); if (error || !data) return { error: error?.message ?? "Schedule could not be created." }; refreshOperations(); return { record: { ...input, id: data.id, status: "Active" as const, lastGeneratedAt: null, createdAt: data.created_at } };
}

export async function setOperationsScheduleStatus(scheduleId: string, status: OperationsScheduleRecord["status"]) { const ctx = await managerContext(); if (!ctx) return { error: "Manager access is required to manage schedules." }; const { error } = await ctx.supabase.from("operations_schedules").update({ status: dbValue(status) }).eq("id", scheduleId).eq("organization_id", ctx.viewer.organizationId); if (error) return { error: error.message }; refreshOperations(); return {}; }

export async function generateOperationsChecklist(schedule: OperationsScheduleRecord) {
  const ctx = await managerContext(); if (!ctx) return { error: "Manager access is required to generate scheduled checklists." };
  const { data: steps, error } = await ctx.supabase.from("operations_procedure_steps").select("title,position").eq("procedure_id", schedule.procedureId).eq("organization_id", ctx.viewer.organizationId).order("position"); if (error || !steps?.length) return { error: error?.message ?? "The procedure has no steps." };
  const created = await saveOperationsChecklist({ title: `${schedule.procedureTitle} â€” ${schedule.location}`, location: schedule.location, owner: schedule.owner, dueDate: schedule.nextRunDate, steps: steps.map((step) => ({ id: "", title: step.title, complete: false })) }); if (created.error) return created;
  const now = new Date().toISOString(); const nextRunDate = getNextScheduleDate(schedule.nextRunDate, schedule.frequency);
  await ctx.supabase.from("operations_schedules").update({ last_generated_at: now, next_run_date: nextRunDate }).eq("id", schedule.id).eq("organization_id", ctx.viewer.organizationId); refreshOperations(); return { record: created.record, lastGeneratedAt: now, nextRunDate };
}

export async function saveOperationsHandoff(input: Omit<OperationsHandoffRecord, "id" | "createdAt" | "updatedAt" | "status">) { const ctx = await context(); if (!ctx) return { error: "Sign in to save shared handoffs." }; const { data, error } = await ctx.supabase.from("operations_handoffs").insert({ organization_id: ctx.viewer.organizationId, location_name: input.location, from_shift: input.fromShift, to_shift: input.toShift, summary: input.summary.trim(), unresolved_issues: input.unresolvedIssues, decisions: input.decisions, owner: input.owner.trim(), created_by: ctx.viewer.id }).select("id,created_at,updated_at").single(); if (error || !data) return { error: error?.message ?? "Handoff could not be created." }; refreshOperations(); return { record: { ...input, id: data.id, status: "Open" as const, createdAt: data.created_at, updatedAt: data.updated_at } }; }
export async function setOperationsHandoffStatus(id: string, status: OperationsHandoffRecord["status"]) { const ctx = await context(); if (!ctx) return { error: "Sign in to update shared handoffs." }; const now = new Date().toISOString(); const patch = status === "Acknowledged" ? { status: "acknowledged", acknowledged_by: ctx.viewer.id, acknowledged_at: now } : { status: "closed", closed_by: ctx.viewer.id, closed_at: now }; const { data, error } = await ctx.supabase.from("operations_handoffs").update(patch).eq("id", id).eq("organization_id", ctx.viewer.organizationId).select("updated_at").single(); if (error || !data) return { error: error?.message ?? "Handoff could not be updated." }; refreshOperations(); return { updatedAt: data.updated_at }; }

export async function saveOperationsIncident(input: Omit<OperationsIncidentRecord, "id" | "createdAt" | "updatedAt" | "status">) { const ctx = await context(); if (!ctx) return { error: "Sign in to save shared incidents." }; const { data, error } = await ctx.supabase.from("operations_incidents").insert({ organization_id: ctx.viewer.organizationId, title: input.title.trim(), category: dbValue(input.category), severity: dbValue(input.severity), location_name: input.location, occurred_at: input.occurredAt, reported_by_name: input.reportedBy.trim(), reported_by_user_id: ctx.viewer.id, description: input.description.trim(), immediate_action: input.immediateAction.trim(), root_cause: input.rootCause, corrective_action: input.correctiveAction, owner: input.owner.trim(), due_date: input.dueDate, created_by: ctx.viewer.id }).select("id,created_at,updated_at").single(); if (error || !data) return { error: error?.message ?? "Incident could not be created." }; refreshOperations(); return { record: { ...input, id: data.id, status: "Reported" as const, createdAt: data.created_at, updatedAt: data.updated_at } }; }
export async function setOperationsIncidentStatus(id: string, status: OperationsIncidentRecord["status"]) { const ctx = await context(); if (!ctx) return { error: "Sign in to update shared incidents." }; const verified = status === "Verified Closed"; const { data, error } = await ctx.supabase.from("operations_incidents").update({ status: dbValue(status), verified_by: verified ? ctx.viewer.id : null, verified_at: verified ? new Date().toISOString() : null }).eq("id", id).eq("organization_id", ctx.viewer.organizationId).select("updated_at").single(); if (error || !data) return { error: error?.message ?? "Incident could not be updated." }; refreshOperations(); return { updatedAt: data.updated_at }; }
