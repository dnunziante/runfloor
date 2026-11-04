import "server-only";
import { canViewExecutive } from "@/lib/auth/permissions";

import type { GrowthPlan } from "@/lib/growth/data";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type PlanRow = {
  id: string; opportunity_slug: string; title: string; owner_name: string; target_date: string;
  target_measure: string; status: string; created_at: string; location_id: string | null;
  locations: { name: string } | { name: string }[] | null;
  growth_action_plan_tasks: Array<{ id: string; title: string; is_complete: boolean; position: number }>;
  growth_plan_outcomes: Array<{ id: string; outcome_date: string; leads: number; appointments: number; revenue: number | string; cost: number | string; notes: string; created_at: string }>;
};

function mapPlan(row: PlanRow): GrowthPlan {
  const location = Array.isArray(row.locations) ? row.locations[0] : row.locations;
  return { id: row.id, opportunitySlug: row.opportunity_slug, title: row.title, locationId: row.location_id, locationName: location?.name ?? "All locations", owner: row.owner_name, targetDate: row.target_date, targetMeasure: row.target_measure, status: row.status === "complete" ? "Complete" : row.status === "in_progress" ? "In progress" : "Not started", tasks: [...row.growth_action_plan_tasks].sort((a, b) => a.position - b.position).map((task) => ({ id: task.id, title: task.title, complete: task.is_complete })), outcomes: [...(row.growth_plan_outcomes ?? [])].sort((a, b) => b.outcome_date.localeCompare(a.outcome_date)).map((outcome) => ({ id: outcome.id, date: outcome.outcome_date, leads: outcome.leads, appointments: outcome.appointments, revenue: Number(outcome.revenue), cost: Number(outcome.cost), notes: outcome.notes, createdAt: outcome.created_at })), createdAt: row.created_at };
}

export async function getGrowthPlans() {
  const viewer = await getViewer();
  if (viewer?.demo && canViewExecutive(viewer.role)) return { plans: [] as GrowthPlan[], persistence: "demo" as const, error: "" };
  if (!viewer || !canViewExecutive(viewer.role)) return { plans: [] as GrowthPlan[], persistence: "supabase" as const, error: "Sign in to view growth plans." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("growth_action_plans").select("id, opportunity_slug, title, location_id, locations(name), owner_name, target_date, target_measure, status, created_at, growth_action_plan_tasks(id, title, is_complete, position), growth_plan_outcomes(id, outcome_date, leads, appointments, revenue, cost, notes, created_at)").eq("organization_id", viewer.organizationId).order("created_at", { ascending: false });
  return { plans: error ? [] : ((data ?? []) as PlanRow[]).map(mapPlan), persistence: "supabase" as const, error: error?.message ?? "" };
}

export async function getGrowthPlan(opportunitySlug: string) {
  const result = await getGrowthPlans();
  return { ...result, plan: result.plans.find((item) => item.opportunitySlug === opportunitySlug) ?? null };
}
