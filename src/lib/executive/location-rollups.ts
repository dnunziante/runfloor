import { ENABLE_SALES_COACHING } from "../features.ts";
export type RollupTargets = { sales: number; coaching: number; growth: number; operations: number; riskLimit: number };
export type RollupLocation = { id: string; name: string };
export type RollupSales = { locationId: string; target: number; actual: number };
export type RollupCoach = { locationId: string | null; status: string };
export type RollupGrowth = { locationId: string | null; tasks: Array<{ complete: boolean }> };
export type RollupOperations = { locationName: string; steps: Array<{ complete: boolean }> };
export type RollupAlert = { locationName: string; status: string };

const completion = (complete: number, total: number) => total ? Math.round(complete / total * 100) : null;

export function buildLocationRollups(input: { locations: RollupLocation[]; sales: RollupSales[]; coaching: RollupCoach[]; growth: RollupGrowth[]; operations: RollupOperations[]; alerts: RollupAlert[]; targets: RollupTargets }) {
  return input.locations.map((location) => {
    const sales = input.sales.filter((item) => item.locationId === location.id);
    const salesTarget = sales.reduce((total, item) => total + item.target, 0);
    const salesPace = salesTarget > 0 ? Math.round(sales.reduce((total, item) => total + item.actual, 0) / salesTarget * 100) : null;
    const coaching = (ENABLE_SALES_COACHING ? input.coaching : []).filter((item) => item.locationId === location.id);
    const coachingCompletion = completion(coaching.filter((item) => item.status === "completed").length, coaching.length);
    const growthTasks = input.growth.filter((item) => item.locationId === location.id).flatMap((item) => item.tasks);
    const growthCompletion = completion(growthTasks.filter((item) => item.complete).length, growthTasks.length);
    const operationSteps = input.operations.filter((item) => item.locationName === location.name || item.locationName === "All locations").flatMap((item) => item.steps);
    const operationsCompletion = completion(operationSteps.filter((item) => item.complete).length, operationSteps.length);
    const openRisks = input.alerts.filter((item) => item.status !== "resolved" && (item.locationName === location.name || item.locationName === "All locations")).length;
    const measures = [[salesPace, input.targets.sales], [coachingCompletion, input.targets.coaching], [growthCompletion, input.targets.growth], [operationsCompletion, input.targets.operations]] as const;
    const available = measures.filter((item): item is readonly [number, number] => item[0] !== null);
    const signal = openRisks > input.targets.riskLimit || available.some(([value, target]) => value < target) ? "Needs attention" : available.length ? available.every(([value, target]) => value >= target) ? "Leading" : "Stable" : "No data";
    return { location: location.name, salesPace, coachingCompletion, growthCompletion, operationsCompletion, openRisks, signal } as const;
  });
}
