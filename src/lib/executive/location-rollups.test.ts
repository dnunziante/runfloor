import assert from "node:assert/strict";
import test from "node:test";
import { buildLocationRollups } from "./location-rollups.ts";

const targets = { sales: 100, coaching: 90, growth: 80, operations: 95, riskLimit: 0 };

test("location rollups calculate assigned sales, coaching, growth, and operations", () => {
  const [result] = buildLocationRollups({ locations: [{ id: "one", name: "North" }], sales: [{ locationId: "one", target: 100, actual: 90 }], coaching: [{ locationId: "one", status: "completed" }, { locationId: "one", status: "in_progress" }], growth: [{ locationId: "one", tasks: [{ complete: true }, { complete: false }] }], operations: [{ locationName: "North", steps: [{ complete: true }] }], alerts: [], targets });
  assert.deepEqual(result, { location: "North", salesPace: 90, coachingCompletion: null, growthCompletion: 50, operationsCompletion: 100, openRisks: 0, signal: "Needs attention" });
});

test("location rollups leave unassigned measures unavailable", () => {
  const [result] = buildLocationRollups({ locations: [{ id: "one", name: "North" }], sales: [], coaching: [{ locationId: null, status: "completed" }], growth: [], operations: [], alerts: [], targets });
  assert.equal(result.salesPace, null); assert.equal(result.coachingCompletion, null); assert.equal(result.growthCompletion, null); assert.equal(result.operationsCompletion, null); assert.equal(result.signal, "No data");
});
