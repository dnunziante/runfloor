import "server-only";

import { canViewExecutive } from "@/lib/auth/permissions";
import { getViewer } from "@/lib/auth/viewer";
import { buildExecutiveTrends, calculateTrendChange, compareExecutiveTrendPeriods, type ExecutiveTrendSourceRow } from "@/lib/executive/trends";
import { createClient } from "@/lib/supabase/server";

type TrendQuery = { months?: string; location?: string; from?: string; to?: string; start?: string; end?: string };
type TrendRow = ExecutiveTrendSourceRow & { locationName: string };
const validRange = (value?: string) => value === "24" ? 24 : value === "12" ? 12 : 6;
const validMonth = (value?: string) => value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : undefined;
const monthKey = (date: Date) => date.toISOString().slice(0, 7);
const periodStart = (months: number) => { const date = new Date(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - months + 1); return `${monthKey(date)}-01`; };
const relatedName = (value: { name: string } | { name: string }[] | null) => Array.isArray(value) ? value[0]?.name ?? "Unknown location" : value?.name ?? "Unknown location";

const demoRows = (): TrendRow[] => {
  const pace = [86, 91, 89, 96, 93, 94];
  return pace.flatMap((value, index) => { const date = new Date(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - (pace.length - index - 1)); const period = `${monthKey(date)}-01`; return [
    { periodStart: period, locationId: "charleston", locationName: "Charleston", revenueTarget: 300000, revenueActual: Math.round(value * 3000 * 1.02), unitsTarget: 24, unitsActual: Math.round(value * .24), leads: 76 + index * 4, appointments: 29 + index * 2 },
    { periodStart: period, locationId: "summerville", locationName: "Summerville", revenueTarget: 200000, revenueActual: Math.round(value * 2000 * .97), unitsTarget: 16, unitsActual: Math.round(value * .16), leads: 49 + index * 2, appointments: 19 + index },
  ]; });
};

function finishWorkspace(rows: TrendRow[], completedPeriods: string[], query: TrendQuery, persistence: "demo" | "supabase", error = "") {
  const months = validRange(query.months);
  const start = validMonth(query.start);
  const end = validMonth(query.end);
  const locations = [...new Map(rows.map((row) => [row.locationId, { id: row.locationId, name: row.locationName }])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const selectedLocation = locations.some((item) => item.id === query.location) ? query.location! : "all";
  const filteredRows = rows.filter((row) => (selectedLocation === "all" || row.locationId === selectedLocation) && (!start || row.periodStart.slice(0, 7) >= start) && (!end || row.periodStart.slice(0, 7) <= end));
  const periods = buildExecutiveTrends(filteredRows, completedPeriods);
  return { canView: true, persistence, months, start, end, periods, locations, selectedLocation, change: calculateTrendChange(periods), comparison: compareExecutiveTrendPeriods(periods, query.from, query.to), error };
}

export async function getExecutiveTrends(query: TrendQuery = {}) {
  const months = validRange(query.months);
  const viewer = await getViewer();
  if (!viewer || !canViewExecutive(viewer.role)) return { canView: false, persistence: "supabase" as const, months, start: undefined, end: undefined, periods: [], locations: [], selectedLocation: "all", change: null, comparison: null, error: "" };
  if (viewer.demo) return finishWorkspace(demoRows().slice(-(months * 2)), [monthKey(new Date())], query, "demo");
  const supabase = await createClient();
  const start = validMonth(query.start) ? `${validMonth(query.start)}-01` : periodStart(months);
  const [salesResult, completionsResult] = await Promise.all([
    supabase.from("sales_results").select("period_start,location_id,revenue_target,revenue_actual,units_target,units_actual,leads,appointments,locations(name)").eq("organization_id", viewer.organizationId).eq("status", "approved").gte("period_start", start).order("period_start"),
    supabase.from("executive_monthly_review_completions").select("reporting_period").eq("organization_id", viewer.organizationId).gte("reporting_period", start).order("reporting_period"),
  ]);
  const rows: TrendRow[] = (salesResult.data ?? []).map((row) => ({ periodStart: row.period_start, locationId: row.location_id, locationName: relatedName(row.locations), revenueTarget: Number(row.revenue_target), revenueActual: Number(row.revenue_actual), unitsTarget: row.units_target, unitsActual: row.units_actual, leads: row.leads, appointments: row.appointments }));
  const completedPeriods = (completionsResult.data ?? []).map((row) => row.reporting_period.slice(0, 7));
  return finishWorkspace(rows, completedPeriods, query, "supabase", salesResult.error?.message ?? completionsResult.error?.message ?? "");
}
