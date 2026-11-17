import { ENABLE_SALES_COACHING } from "../features.ts";
export type ExecutiveReadinessInput = {
  locationIds: string[];
  locationNames: string[];
  approvedLocationIds: string[];
  approvedPeriods: string[];
  targetsConfigured: boolean;
  coachingTotal: number;
  coachingUnassigned: number;
  growthTotal: number;
  growthUnassigned: number;
  operationsLocationNames: string[];
  reviewCompleted: boolean;
};

export type ExecutiveReadinessCheck = { id: string; title: string; explanation: string; action: string; href: string; required: boolean; ready: boolean };

export function buildExecutiveReadiness(input: ExecutiveReadinessInput) {
  const normalizedOperations = new Set(input.operationsLocationNames.map((name) => name.trim().toLowerCase()));
  const missingSales = input.locationIds.filter((id) => !input.approvedLocationIds.includes(id)).length;
  const missingOperations = input.locationNames.filter((name) => !normalizedOperations.has(name.trim().toLowerCase())).length;
  const checks: ExecutiveReadinessCheck[] = [
    { id: "locations", title: "Business locations", explanation: input.locationIds.length ? `${input.locationIds.length} active location${input.locationIds.length === 1 ? " is" : "s are"} available for reporting.` : "No active locations are configured.", action: "Configure at least one active location.", href: "/admin/settings", required: true, ready: input.locationIds.length > 0 },
    { id: "sales", title: "Approved monthly sales", explanation: input.locationIds.length && !missingSales ? `Every active location has an approved result for this period.` : `${missingSales} active location${missingSales === 1 ? " is" : "s are"} missing an approved result for this period.`, action: "Enter and approve the missing monthly location results.", href: "/admin/sales-results/quality", required: true, ready: input.locationIds.length > 0 && missingSales === 0 },
    { id: "targets", title: "Executive targets", explanation: input.targetsConfigured ? "Workspace performance and risk targets are configured." : "The dashboard is using sample defaults because workspace targets are missing.", action: "Save Executive targets for this workspace.", href: "/admin/executive", required: true, ready: input.targetsConfigured },
    { id: "coaching", title: "Coaching location assignments", explanation: input.coachingTotal ? `${input.coachingTotal - input.coachingUnassigned} of ${input.coachingTotal} coaching sessions are assigned to a location.` : "No coaching sessions are available for leadership reporting.", action: "Assign every coaching session to a location.", href: "/coach/review", required: true, ready: input.coachingTotal > 0 && input.coachingUnassigned === 0 },
    { id: "growth", title: "Growth-plan location assignments", explanation: input.growthTotal ? `${input.growthTotal - input.growthUnassigned} of ${input.growthTotal} growth plans are assigned to a location.` : "No growth plans are available for leadership reporting.", action: "Assign every active growth plan to a location.", href: "/growth/plans", required: true, ready: input.growthTotal > 0 && input.growthUnassigned === 0 },
    { id: "operations", title: "Operations location coverage", explanation: input.locationNames.length && !missingOperations ? "Every active location has operations checklist data." : `${missingOperations} active location${missingOperations === 1 ? " has" : "s have"} no operations checklist data.`, action: "Create or assign checklist data for each active location.", href: "/operations/checklists", required: true, ready: input.locationNames.length > 0 && missingOperations === 0 },
    { id: "history", title: "Historical comparison depth", explanation: input.approvedPeriods.length >= 2 ? `${input.approvedPeriods.length} approved reporting periods support trend comparison.` : "At least two approved periods are needed for dependable trend comparison.", action: "Approve another monthly reporting period.", href: "/admin/sales-results", required: false, ready: input.approvedPeriods.length >= 2 },
    { id: "review", title: "Leadership review completion", explanation: input.reviewCompleted ? "The leadership review is recorded complete for this period." : "The leadership review has not been recorded complete for this period.", action: "Complete the monthly leadership review after the meeting.", href: "/executive/review", required: false, ready: input.reviewCompleted },
  ];
  const visibleChecks = checks.filter(check => ENABLE_SALES_COACHING || check.id !== "coaching");
  const required = visibleChecks.filter((check) => check.required);
  const readyRequired = required.filter((check) => check.ready).length;
  return { checks: visibleChecks, requiredTotal: required.length, readyRequired, score: required.length ? Math.round(readyRequired / required.length * 100) : 0, missingSales, missingOperations };
}
