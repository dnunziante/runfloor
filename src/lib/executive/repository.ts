import { ENABLE_SALES_COACHING, isFeatureDestinationEnabled } from "@/lib/features";
import "server-only";

import { canManageExecutiveTargets, canViewExecutive } from "@/lib/auth/permissions";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { buildLocationRollups } from "@/lib/executive/location-rollups";
import {
  defaultExecutiveTargets,
  executiveLocations,
  executiveMetrics,
  executiveRisks,
  executiveSignals,
  executiveWins,
  rankExecutivePriorities,
  type ExecutiveMetric,
  type ExecutivePriority,
  type ExecutivePriorityReview,
  type ExecutiveSignal,
  type ExecutiveTargets,
  type LocationSummary,
} from "@/lib/executive/data";

export type ExecutiveWorkspace = {
  persistence: "demo" | "supabase";
  error: string;
  canView: boolean;
  canEditTargets: boolean;
  targets: ExecutiveTargets;
  metrics: ExecutiveMetric[];
  signals: ExecutiveSignal[];
  priorities: ExecutivePriority[];
  locations: LocationSummary[];
  risks: ReadonlyArray<{ title: string; owner: string; due: string; href: string }>;
  wins: readonly string[];
  reportingPeriod: string;
  availablePeriods: string[];
  reviews: Record<string, ExecutivePriorityReview>;
  canManageReviews: boolean;
};

const percent = (complete: number, total: number) => total ? Math.round(complete / total * 100) : null;
const metricTone = (value: number | null, target: number): ExecutiveMetric["tone"] => value === null ? "neutral" : value >= target ? "positive" : "attention";
const signal = (label: string, value: number, target: number, href: string): ExecutiveSignal => ({ label, value, target, unit: "%", href });

const validMonth = (value?: string) => /^\d{4}-\d{2}$/.test(value ?? "") ? value! : new Date().toISOString().slice(0, 7);

export async function getExecutiveWorkspace(period?: string): Promise<ExecutiveWorkspace> {
  const viewer = await getViewer();
  const requestedPeriod = validMonth(period);
  if (viewer?.demo) return { persistence: "demo", error: "", canView: true, canEditTargets: true, canManageReviews: true, targets: defaultExecutiveTargets, metrics: executiveMetrics.filter(item => ENABLE_SALES_COACHING || !/coaching|development/i.test(item.label)), signals: executiveSignals.filter(item => isFeatureDestinationEnabled(item.href)), priorities: rankExecutivePriorities().filter(item => isFeatureDestinationEnabled(item.href)).map((item, index) => ({ ...item, rank: index + 1 })), locations: executiveLocations, risks: executiveRisks.filter(item => isFeatureDestinationEnabled(item.href)), wins: executiveWins, reportingPeriod: requestedPeriod, availablePeriods: [requestedPeriod], reviews: {} };
  if (!viewer) return { persistence: "supabase", error: "Sign in to view Executive reporting.", canView: false, canEditTargets: false, canManageReviews: false, targets: defaultExecutiveTargets, metrics: [], signals: [], priorities: [], locations: [], risks: [], wins: [], reportingPeriod: requestedPeriod, availablePeriods: [requestedPeriod], reviews: {} };

  const canView = canViewExecutive(viewer.role);
  if (!canView) return { persistence: "supabase", error: "", canView: false, canEditTargets: false, canManageReviews: false, targets: defaultExecutiveTargets, metrics: [], signals: [], priorities: [], locations: [], risks: [], wins: [], reportingPeriod: requestedPeriod, availablePeriods: [requestedPeriod], reviews: {} };

  const supabase = await createClient();
  const organizationId = viewer.organizationId;
  const [targetsResult, locationsResult, salesResult, coachingResult, growthResult, checklistsResult, alertsResult, improvementsResult, reviewsResult] = await Promise.all([
    supabase.from("executive_targets").select("sales_pace_target,coaching_completion_target,growth_completion_target,operations_completion_target,high_risk_limit").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("locations").select("id,name").eq("organization_id", organizationId).order("name"),
    supabase.from("sales_results").select("location_id,period_start,revenue_target,revenue_actual,locations(name)").eq("organization_id", organizationId).eq("status", "approved").order("period_start", { ascending: false }),
    supabase.from("coach_sessions").select("location_id,status").eq("organization_id", organizationId),
    supabase.from("growth_action_plans").select("location_id,growth_action_plan_tasks(is_complete)").eq("organization_id", organizationId),
    supabase.from("operations_checklists").select("location_name,operations_checklist_steps(is_complete)").eq("organization_id", organizationId),
    supabase.from("operations_alerts").select("title,severity,status,owner,location_name,due_date").eq("organization_id", organizationId),
    supabase.from("operations_improvements").select("status").eq("organization_id", organizationId),
    supabase.from("executive_priority_reviews").select("id,priority_key,reporting_period,status,owner_name,due_date,review_note,updated_at").eq("organization_id", organizationId).eq("reporting_period", `${requestedPeriod}-01`),
  ]);
  const targetRow = targetsResult.data;
  const targets: ExecutiveTargets = targetRow ? { salesPace: targetRow.sales_pace_target, coachingCompletion: targetRow.coaching_completion_target, growthCompletion: targetRow.growth_completion_target, operationsCompletion: targetRow.operations_completion_target, highRiskLimit: targetRow.high_risk_limit } : defaultExecutiveTargets;
  const salesRows = salesResult.data ?? [];
  const availablePeriods = [...new Set([requestedPeriod, ...salesRows.map((item) => item.period_start.slice(0, 7))])].sort().reverse();
  const currentSalesRows = salesRows.filter((item) => item.period_start === `${requestedPeriod}-01`);
  const salesTarget = currentSalesRows.reduce((total, item) => total + Number(item.revenue_target), 0);
  const salesActual = currentSalesRows.reduce((total, item) => total + Number(item.revenue_actual), 0);
  const sales = salesTarget > 0 ? Math.round(salesActual / salesTarget * 100) : null;
  const coaching = percent((coachingResult.data ?? []).filter((item) => item.status === "completed").length, coachingResult.data?.length ?? 0);
  const growthTasks = (growthResult.data ?? []).flatMap((item) => item.growth_action_plan_tasks ?? []);
  const growth = percent(growthTasks.filter((item) => item.is_complete).length, growthTasks.length);
  const checklistRows = checklistsResult.data ?? [];
  const allSteps = checklistRows.flatMap((item) => (item.operations_checklist_steps ?? []) as Array<{ is_complete: boolean }>);
  const operations = percent(allSteps.filter((item) => item.is_complete).length, allSteps.length);
  const highRisks = (alertsResult.data ?? []).filter((item) => item.status !== "resolved" && (item.severity === "high" || item.severity === "critical"));
  const verifiedImprovements = (improvementsResult.data ?? []).filter((item) => item.status === "verified" || item.status === "closed").length;

  const metrics: ExecutiveMetric[] = [
    { label: "Sales pace", value: sales === null ? "—" : `${sales}%`, context: sales === null ? `No approved sales target for ${requestedPeriod}` : `${currentSalesRows.length} approved location result${currentSalesRows.length === 1 ? "" : "s"} for ${requestedPeriod}`, tone: metricTone(sales, targets.salesPace) },
    { label: "Coaching completion", value: coaching === null ? "—" : `${coaching}%`, context: coaching === null ? "No coaching sessions recorded" : `${coachingResult.data?.length ?? 0} persisted sessions`, tone: metricTone(coaching, targets.coachingCompletion) },
    { label: "Growth execution", value: growth === null ? "—" : `${growth}%`, context: growth === null ? "No growth tasks recorded" : `${growthTasks.length} persisted tasks`, tone: metricTone(growth, targets.growthCompletion) },
    { label: "Operations execution", value: operations === null ? "—" : `${operations}%`, context: operations === null ? "No checklist steps recorded" : `${allSteps.length} persisted steps`, tone: metricTone(operations, targets.operationsCompletion) },
  ];
  const signals: ExecutiveSignal[] = [
    ...(sales === null ? [] : [signal("Sales pace", sales, targets.salesPace, "/admin/sales-results")]),
    ...(coaching === null ? [] : [signal("Coaching completion", coaching, targets.coachingCompletion, "/coach")]),
    ...(growth === null ? [] : [signal("Growth plan completion", growth, targets.growthCompletion, "/growth/performance")]),
    ...(operations === null ? [] : [signal("Operations completion", operations, targets.operationsCompletion, "/operations/performance")]),
  ];

  const priorityInputs: Array<Omit<ExecutivePriority, "rank"> & { score: number }> = [];
  if (sales !== null && sales < targets.salesPace) priorityInputs.push({ id: "sales-pace", score: 90 + (targets.salesPace - sales), title: "Review sales pace by location", area: "Sales", reason: `Approved sales pace is ${sales}%, below the ${targets.salesPace}% tenant target.`, action: "Review the approved monthly results and focus on locations below target.", href: "/admin/sales-results", urgency: "Act now" });
  if (highRisks.length > targets.highRiskLimit) priorityInputs.push({ id: "high-risk-operations", score: 100, title: "Resolve high-severity operational risks", area: "Operations", reason: `${highRisks.length} persisted high-severity alert${highRisks.length === 1 ? " is" : "s are"} above the configured limit of ${targets.highRiskLimit}.`, action: "Confirm an owner and due date for each open high-severity alert.", href: "/operations/alerts", urgency: "Act now" });
  if (operations !== null && operations < targets.operationsCompletion) priorityInputs.push({ id: "operations-completion", score: 80 + (targets.operationsCompletion - operations), title: "Raise operational completion", area: "Operations", reason: `Checklist completion is ${operations}%, below the ${targets.operationsCompletion}% tenant target.`, action: "Review incomplete checklist steps by location before adding new recurring work.", href: "/operations/performance", urgency: "This week" });
  if (growth !== null && growth < targets.growthCompletion) priorityInputs.push({ id: "growth-completion", score: 70 + (targets.growthCompletion - growth), title: "Advance active growth work", area: "Growth", reason: `Growth task completion is ${growth}%, below the ${targets.growthCompletion}% tenant target.`, action: "Confirm the owner and next incomplete task for each active growth plan.", href: "/growth/plans", urgency: "This week" });
  if (ENABLE_SALES_COACHING && coaching !== null && coaching < targets.coachingCompletion) priorityInputs.push({ id: "coaching-completion", score: 60 + (targets.coachingCompletion - coaching), title: "Improve coaching follow-through", area: "People", reason: `Completed coaching sessions are ${coaching}%, below the ${targets.coachingCompletion}% tenant target.`, action: "Review incomplete sessions and assign the next focused practice activity.", href: "/coach/review", urgency: "This week" });
  const priorities = priorityInputs.sort((a, b) => b.score - a.score).map((item, index) => ({ id: item.id, title: item.title, area: item.area, reason: item.reason, action: item.action, href: item.href, urgency: item.urgency, rank: index + 1 }));

  const locations: LocationSummary[] = buildLocationRollups({
    locations: locationsResult.data ?? [],
    sales: currentSalesRows.map((item) => ({ locationId: item.location_id, target: Number(item.revenue_target), actual: Number(item.revenue_actual) })),
    coaching: (ENABLE_SALES_COACHING ? coachingResult.data ?? [] : []).map((item) => ({ locationId: item.location_id, status: item.status })),
    growth: (growthResult.data ?? []).map((item) => ({ locationId: item.location_id, tasks: (item.growth_action_plan_tasks ?? []).map((task) => ({ complete: task.is_complete })) })),
    operations: checklistRows.map((item) => ({ locationName: item.location_name, steps: ((item.operations_checklist_steps ?? []) as Array<{ is_complete: boolean }>).map((step) => ({ complete: step.is_complete })) })),
    alerts: (alertsResult.data ?? []).map((item) => ({ locationName: item.location_name, status: item.status })),
    targets: { sales: targets.salesPace, coaching: targets.coachingCompletion, growth: targets.growthCompletion, operations: targets.operationsCompletion, riskLimit: targets.highRiskLimit },
  });
  const risks = highRisks.slice(0, 4).map((item) => ({ title: item.title, owner: item.owner, due: item.due_date, href: "/operations/alerts" }));
  const wins = [
    ...(operations !== null && operations >= targets.operationsCompletion ? [`Operations completion meets the ${targets.operationsCompletion}% tenant target.`] : []),
    ...(growth !== null && growth >= targets.growthCompletion ? [`Growth execution meets the ${targets.growthCompletion}% tenant target.`] : []),
    ...(coaching !== null && coaching >= targets.coachingCompletion ? [`Coaching completion meets the ${targets.coachingCompletion}% tenant target.`] : []),
    ...(verifiedImprovements ? [`${verifiedImprovements} improvement outcome${verifiedImprovements === 1 ? " is" : "s are"} verified.`] : []),
  ];
  const reviews = Object.fromEntries((reviewsResult.data ?? []).map((item) => [item.priority_key, { id: item.id, priorityKey: item.priority_key, reportingPeriod: item.reporting_period, status: item.status, ownerName: item.owner_name, dueDate: item.due_date ?? "", reviewNote: item.review_note, updatedAt: item.updated_at } as ExecutivePriorityReview]));
  const firstError = [targetsResult, locationsResult, salesResult, coachingResult, growthResult, checklistsResult, alertsResult, improvementsResult, reviewsResult].find((result) => result.error)?.error;
  return { persistence: "supabase", error: firstError?.message ?? "", canView, canEditTargets: canManageExecutiveTargets(viewer.role), canManageReviews: true, targets, metrics: metrics.filter(item => ENABLE_SALES_COACHING || !/coaching|development/i.test(item.label)), signals: signals.filter(item => isFeatureDestinationEnabled(item.href)), priorities, locations, risks, wins: wins.filter(item => ENABLE_SALES_COACHING || !/coaching/i.test(item)), reportingPeriod: requestedPeriod, availablePeriods, reviews };
}
