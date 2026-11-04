"use server";

import { canViewExecutive } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import type { GrowthOutcome, GrowthPlan } from "@/lib/growth/data";
import { createClient } from "@/lib/supabase/server";

export async function updateGrowthOpportunityProgress(input: { slug: string; lifecycleStatus: string; progress: number; note?: string }) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || !canViewExecutive(viewer.role)) return { error: "Sign in to update opportunities." };
  if (!["idea","under_review","approved","planned","in_progress","blocked","completed","validated","not_pursuing","archived"].includes(input.lifecycleStatus) || !Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100) return { error: "Enter a valid status and progress." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("growth_opportunities").update({ lifecycle_status: input.lifecycleStatus, progress: input.progress, updated_at: new Date().toISOString() }).eq("organization_id", viewer.organizationId).eq("slug", input.slug).select("id").single();
  if (error || !data) return { error: error?.message ?? "Opportunity could not be updated." };
  await supabase.from("growth_opportunity_activity").insert({ organization_id: viewer.organizationId, opportunity_id: data.id, actor_id: viewer.id, activity_type: "progress_updated", description: input.note?.trim() || `Status changed to ${input.lifecycleStatus.replaceAll("_", " ")} at ${input.progress}%.` });
  revalidatePath("/growth"); revalidatePath(`/growth/opportunities/${input.slug}`); return {};
}

type CreateInput = { opportunitySlug: string; title: string; locationId: string | null; locationName: string; owner: string; targetDate: string; targetMeasure: string; tasks: string[] };

export async function createPersistentGrowthPlan(input: CreateInput): Promise<{ plan?: GrowthPlan; error?: string }> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || !canViewExecutive(viewer.role)) return { error: "Sign in to save this plan to the shared workspace." };
  if (!input.opportunitySlug || input.owner.trim().length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate) || !input.tasks.length) return { error: "Complete the owner, target date, measure, and tasks." };
  const supabase = await createClient();
  if (input.locationId) { const { data: location } = await supabase.from("locations").select("id").eq("id", input.locationId).eq("organization_id", viewer.organizationId).maybeSingle(); if (!location) return { error: "That location is not part of this organization." }; }
  const { data: plan, error } = await supabase.from("growth_action_plans").insert({ organization_id: viewer.organizationId, opportunity_slug: input.opportunitySlug, title: input.title, location_id: input.locationId, owner_name: input.owner.trim(), target_date: input.targetDate, target_measure: input.targetMeasure, created_by: viewer.id }).select("id, created_at").single();
  if (error || !plan) return { error: error?.code === "23505" ? "An action plan already exists for this opportunity." : error?.message ?? "The plan could not be created." };
  const { data: tasks, error: taskError } = await supabase.from("growth_action_plan_tasks").insert(input.tasks.map((title, index) => ({ organization_id: viewer.organizationId, plan_id: plan.id, position: index + 1, title }))).select("id, title, is_complete, position");
  if (taskError) { await supabase.from("growth_action_plans").delete().eq("id", plan.id); return { error: taskError.message }; }
  revalidatePath("/growth/plans"); revalidatePath(`/growth/opportunities/${input.opportunitySlug}`);
  return { plan: { id: plan.id, opportunitySlug: input.opportunitySlug, title: input.title, locationId: input.locationId, locationName: input.locationName || "All locations", owner: input.owner.trim(), targetDate: input.targetDate, targetMeasure: input.targetMeasure, status: "Not started", tasks: (tasks ?? []).sort((a, b) => a.position - b.position).map((task) => ({ id: task.id, title: task.title, complete: task.is_complete })), outcomes: [], createdAt: plan.created_at } };
}

export async function togglePersistentGrowthTask(planId: string, taskId: string, complete: boolean): Promise<{ plan?: GrowthPlan; error?: string }> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || !canViewExecutive(viewer.role)) return { error: "Sign in to update this shared plan." };
  const supabase = await createClient();
  const { error } = await supabase.from("growth_action_plan_tasks").update({ is_complete: complete, completed_at: complete ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", taskId).eq("plan_id", planId).eq("organization_id", viewer.organizationId);
  if (error) return { error: error.message };
  const { data: tasks, error: tasksError } = await supabase.from("growth_action_plan_tasks").select("id, title, is_complete, position").eq("plan_id", planId).eq("organization_id", viewer.organizationId).order("position");
  if (tasksError || !tasks) return { error: tasksError?.message ?? "Task progress could not be refreshed." };
  const completed = tasks.filter((task) => task.is_complete).length;
  const status = completed === tasks.length ? "complete" : completed > 0 ? "in_progress" : "not_started";
  const { data: row, error: planError } = await supabase.from("growth_action_plans").update({ status, updated_at: new Date().toISOString() }).eq("id", planId).eq("organization_id", viewer.organizationId).select("id, opportunity_slug, title, location_id, locations(name), owner_name, target_date, target_measure, created_at").single();
  if (planError || !row) return { error: planError?.message ?? "Plan status could not be updated." };
  revalidatePath("/growth/plans"); revalidatePath(`/growth/opportunities/${row.opportunity_slug}`);
  const { data: outcomeRows } = await supabase.from("growth_plan_outcomes").select("id, outcome_date, leads, appointments, revenue, cost, notes, created_at").eq("plan_id", planId).eq("organization_id", viewer.organizationId).order("outcome_date", { ascending: false });
  const location = Array.isArray(row.locations) ? row.locations[0] : row.locations;
  return { plan: { id: row.id, opportunitySlug: row.opportunity_slug, title: row.title, locationId: row.location_id, locationName: location?.name ?? "All locations", owner: row.owner_name, targetDate: row.target_date, targetMeasure: row.target_measure, status: status === "complete" ? "Complete" : status === "in_progress" ? "In progress" : "Not started", tasks: tasks.map((task) => ({ id: task.id, title: task.title, complete: task.is_complete })), outcomes: (outcomeRows ?? []).map((item) => ({ id: item.id, date: item.outcome_date, leads: item.leads, appointments: item.appointments, revenue: Number(item.revenue), cost: Number(item.cost), notes: item.notes, createdAt: item.created_at })), createdAt: row.created_at } };
}

type OutcomeInput = { planId: string; date: string; leads: number; appointments: number; revenue: number; cost: number; notes: string };

export async function createPersistentGrowthOutcome(input: OutcomeInput): Promise<{ outcome?: GrowthOutcome; error?: string }> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || !canViewExecutive(viewer.role)) return { error: "Sign in to save this outcome to the shared workspace." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || ![input.leads, input.appointments, input.revenue, input.cost].every((value) => Number.isFinite(value) && value >= 0) || input.notes.length > 1000) return { error: "Enter a valid date and non-negative outcome values." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("growth_plan_outcomes").insert({ organization_id: viewer.organizationId, plan_id: input.planId, outcome_date: input.date, leads: Math.floor(input.leads), appointments: Math.floor(input.appointments), revenue: input.revenue, cost: input.cost, notes: input.notes.trim(), recorded_by: viewer.id }).select("id, outcome_date, leads, appointments, revenue, cost, notes, created_at").single();
  if (error || !data) return { error: error?.message ?? "The outcome could not be recorded." };
  revalidatePath("/growth/performance"); revalidatePath("/growth/plans");
  return { outcome: { id: data.id, date: data.outcome_date, leads: data.leads, appointments: data.appointments, revenue: Number(data.revenue), cost: Number(data.cost), notes: data.notes, createdAt: data.created_at } };
}

export async function deletePersistentGrowthOutcome(planId: string, outcomeId: string): Promise<{ error?: string }> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || !canViewExecutive(viewer.role)) return { error: "Sign in to remove this outcome from the shared workspace." };
  const supabase = await createClient();
  const { error } = await supabase.from("growth_plan_outcomes").delete().eq("id", outcomeId).eq("plan_id", planId).eq("organization_id", viewer.organizationId);
  if (error) return { error: error.message };
  revalidatePath("/growth/performance"); revalidatePath("/growth/plans");
  return {};
}
