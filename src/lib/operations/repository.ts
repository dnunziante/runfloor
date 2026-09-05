import "server-only";

import { getViewer } from "@/lib/auth/viewer";
import { canManageOperations } from "@/lib/auth/permissions";
import {
  operationsAlertRecords,
  operationsChecklistRecords,
  operationsHandoffRecords,
  operationsIncidentRecords,
  operationsProcedureRecords,
  defaultOperationsProcedureCategories,
  operationsScheduleRecords,
  type OperationsAlertRecord,
  type OperationsChecklistRecord,
  type OperationsHandoffRecord,
  type OperationsIncidentRecord,
  type OperationsProcedureRecord,
  type OperationsProcedureCategory,
  type OperationsScheduleRecord,
} from "@/lib/operations/data";
import { createClient } from "@/lib/supabase/server";

export type OperationsPersistence = "demo" | "supabase";
export type OperationsWorkspace = {
  persistence: OperationsPersistence;
  error: string;
  canManage: boolean;
  checklists: OperationsChecklistRecord[];
  procedures: OperationsProcedureRecord[];
  procedureCategories: OperationsProcedureCategory[];
  alerts: OperationsAlertRecord[];
  schedules: OperationsScheduleRecord[];
  handoffs: OperationsHandoffRecord[];
  incidents: OperationsIncidentRecord[];
};

const titleCase = (value: string) => value.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");

export async function getOperationsWorkspace(): Promise<OperationsWorkspace> {
  const viewer = await getViewer();
  if (viewer?.demo) return {
    persistence: "demo", error: "", canManage: true, checklists: operationsChecklistRecords,
    procedures: operationsProcedureRecords, procedureCategories: defaultOperationsProcedureCategories, alerts: operationsAlertRecords,
    schedules: operationsScheduleRecords, handoffs: operationsHandoffRecords,
    incidents: operationsIncidentRecords,
  };
  if (!viewer) return {
    persistence: "supabase", error: "Sign in to view operations.", canManage: false,
    checklists: [], procedures: [], procedureCategories: [], alerts: [], schedules: [], handoffs: [], incidents: [],
  };

  const supabase = await createClient();
  const organizationId = viewer.organizationId;
  const [checklistsResult, proceduresResult, categoriesResult, alertsResult, schedulesResult, handoffsResult, incidentsResult] = await Promise.all([
    supabase.from("operations_checklists").select("id,title,location_name,owner,due_date,created_at,operations_checklist_steps(id,title,is_complete,position)").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("operations_procedures").select("id,title,category_id,category,owner,summary,status,version,updated_at,sort_order,content,source_type,operations_procedure_categories(name),operations_procedure_steps(id,title,position)").eq("organization_id", organizationId).neq("status", "archived").order("sort_order").order("updated_at", { ascending: false }),
    supabase.from("operations_procedure_categories").select("id,name,is_default").eq("organization_id", organizationId).order("is_default", { ascending: false }).order("name"),
    supabase.from("operations_alerts").select("id,title,detail,severity,location_name,owner,due_date,status,created_at,operations_alert_history(id,status,note,created_at)").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("operations_schedules").select("id,procedure_id,frequency,location_name,owner,next_run_date,status,last_generated_at,created_at,operations_procedures(title)").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("operations_handoffs").select("id,location_name,from_shift,to_shift,summary,unresolved_issues,decisions,owner,status,created_at,updated_at").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("operations_incidents").select("id,title,category,severity,location_name,occurred_at,reported_by_name,description,immediate_action,root_cause,corrective_action,owner,due_date,status,created_at,updated_at").eq("organization_id", organizationId).order("created_at", { ascending: false }),
  ]);
  const firstError = [checklistsResult, proceduresResult, categoriesResult, alertsResult, schedulesResult, handoffsResult, incidentsResult].find((result) => result.error)?.error;

  type ChildStep = { id: string; title: string; position: number };
  const procedures = (proceduresResult.data ?? []).map((row) => ({
    id: row.id, title: row.title, categoryId: row.category_id, category: (row.operations_procedure_categories as unknown as { name: string } | null)?.name ?? row.category, owner: row.owner,
    summary: row.summary, status: titleCase(row.status) as OperationsProcedureRecord["status"], version: row.version,
    updatedAt: row.updated_at, sortOrder: row.sort_order, content: (row.content ?? {}) as Record<string, unknown>, sourceType: row.source_type as OperationsProcedureRecord["sourceType"], steps: [...((row.operations_procedure_steps ?? []) as ChildStep[])].sort((a, b) => a.position - b.position).map((step) => step.title),
  }));
  const checklists = (checklistsResult.data ?? []).map((row) => ({
    id: row.id, title: row.title, location: row.location_name, owner: row.owner, dueDate: row.due_date, createdAt: row.created_at,
    steps: [...((row.operations_checklist_steps ?? []) as Array<ChildStep & { is_complete: boolean }>)].sort((a, b) => a.position - b.position).map((step) => ({ id: step.id, title: step.title, complete: step.is_complete })),
  }));
  const alerts = (alertsResult.data ?? []).map((row) => ({
    id: row.id, title: row.title, detail: row.detail, severity: titleCase(row.severity) as OperationsAlertRecord["severity"],
    location: row.location_name, owner: row.owner, dueDate: row.due_date, status: titleCase(row.status) as OperationsAlertRecord["status"], createdAt: row.created_at,
    history: [...((row.operations_alert_history ?? []) as Array<{ id: string; status: string; note: string; created_at: string }>)].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((item) => ({ id: item.id, status: titleCase(item.status) as OperationsAlertRecord["status"], note: item.note, changedAt: item.created_at })),
  }));
  const schedules = (schedulesResult.data ?? []).map((row) => ({
    id: row.id, procedureId: row.procedure_id, procedureTitle: (row.operations_procedures as unknown as { title: string } | null)?.title ?? "Procedure",
    frequency: titleCase(row.frequency) as OperationsScheduleRecord["frequency"], location: row.location_name, owner: row.owner,
    nextRunDate: row.next_run_date, status: titleCase(row.status) as OperationsScheduleRecord["status"], lastGeneratedAt: row.last_generated_at, createdAt: row.created_at,
  }));
  const handoffs = (handoffsResult.data ?? []).map((row) => ({ id: row.id, location: row.location_name, fromShift: row.from_shift, toShift: row.to_shift, summary: row.summary, unresolvedIssues: row.unresolved_issues, decisions: row.decisions, owner: row.owner, status: titleCase(row.status) as OperationsHandoffRecord["status"], createdAt: row.created_at, updatedAt: row.updated_at }));
  const incidents = (incidentsResult.data ?? []).map((row) => ({ id: row.id, title: row.title, category: titleCase(row.category) as OperationsIncidentRecord["category"], severity: titleCase(row.severity) as OperationsIncidentRecord["severity"], location: row.location_name, occurredAt: row.occurred_at.slice(0, 16), reportedBy: row.reported_by_name, description: row.description, immediateAction: row.immediate_action, rootCause: row.root_cause, correctiveAction: row.corrective_action, owner: row.owner, dueDate: row.due_date, status: titleCase(row.status) as OperationsIncidentRecord["status"], createdAt: row.created_at, updatedAt: row.updated_at }));

  const procedureCategories = (categoriesResult.data ?? []).map((row) => ({ id: row.id, name: row.name, isDefault: row.is_default }));
  return { persistence: "supabase", error: firstError?.message ?? "", canManage: canManageOperations(viewer.role), checklists, procedures, procedureCategories, alerts, schedules, handoffs, incidents };
}
