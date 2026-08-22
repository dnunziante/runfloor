"use server";

import { revalidatePath } from "next/cache";
import { canManageExecutiveTargets } from "@/lib/auth/permissions";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export type SalesResultInput = { locationId: string; periodStart: string; revenueTarget: number; revenueActual: number; unitsTarget: number; unitsActual: number; leads: number; appointments: number; notes: string; status: "draft" | "approved" };

export async function saveSalesResult(input: SalesResultInput) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return { error: "" };
  if (!canManageExecutiveTargets(viewer.role)) return { error: "Only tenant administrators can manage approved sales results." };
  const wholeNumbers = [input.unitsTarget, input.unitsActual, input.leads, input.appointments];
  if (!/^[0-9a-f-]{36}$/i.test(input.locationId) || !/^\d{4}-\d{2}-01$/.test(input.periodStart) || [input.revenueTarget, input.revenueActual].some((value) => !Number.isFinite(value) || value < 0) || wholeNumbers.some((value) => !Number.isInteger(value) || value < 0) || input.notes.length > 2000) return { error: "Enter a valid location, month, and non-negative sales figures." };
  const supabase = await createClient();
  const { data: location } = await supabase.from("locations").select("id").eq("id", input.locationId).eq("organization_id", viewer.organizationId).maybeSingle();
  if (!location) return { error: "That location is not part of this organization." };
  const approved = input.status === "approved";
  const { error } = await supabase.from("sales_results").upsert({ organization_id: viewer.organizationId, location_id: input.locationId, period_start: input.periodStart, revenue_target: input.revenueTarget, revenue_actual: input.revenueActual, units_target: input.unitsTarget, units_actual: input.unitsActual, leads: input.leads, appointments: input.appointments, notes: input.notes.trim(), status: input.status, created_by: viewer.id, updated_by: viewer.id, approved_by: approved ? viewer.id : null, approved_at: approved ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "organization_id,location_id,period_start" });
  if (!error) { revalidatePath("/admin/sales-results"); revalidatePath("/executive"); }
  return { error: error?.message ?? "" };
}

export async function resetBgcDemoPerformance() {
  const viewer = await getViewer();
  if (!viewer || viewer.organizationId !== "10000000-0000-0000-0000-000000000001" || !canManageExecutiveTargets(viewer.role)) return { error: "Only BGC Demo tenant administrators can reset demo performance data." };
  const { error } = await (await createClient()).rpc("reset_bgc_demo_performance");
  if (!error) { revalidatePath("/admin/sales-results"); revalidatePath("/executive"); revalidatePath("/executive/trends"); }
  return { error: error?.message ?? "" };
}
