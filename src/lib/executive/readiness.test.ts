import assert from "node:assert/strict";
import test from "node:test";
import { buildExecutiveReadiness } from "./readiness.ts";

const completeInput = { locationIds: ["a", "b"], locationNames: ["North", "South"], approvedLocationIds: ["a", "b"], approvedPeriods: ["2026-07", "2026-08"], targetsConfigured: true, coachingTotal: 2, coachingUnassigned: 0, growthTotal: 1, growthUnassigned: 0, operationsLocationNames: ["north", "South"], reviewCompleted: true };

test("marks complete tenant source coverage ready", () => {
  const result = buildExecutiveReadiness(completeInput);
  assert.equal(result.score, 100);
  assert.equal(result.checks.every((check) => check.ready), true);
});

test("reports exact missing sales and assignment gaps without estimating", () => {
  const result = buildExecutiveReadiness({ ...completeInput, approvedLocationIds: ["a"], coachingUnassigned: 1, reviewCompleted: false });
  assert.equal(result.missingSales, 1);
  assert.equal(result.checks.find((check) => check.id === "sales")?.ready, false);
  assert.equal(result.checks.some((check) => check.id === "coaching"), false);
  assert.equal(result.readyRequired, 4);
});

test("workspace-wide checklist assignments cover every active location", () => {
  const result = buildExecutiveReadiness({ ...completeInput, operationsLocationNames: [" All locations "] });
  assert.equal(result.missingOperations, 0);
  assert.equal(result.checks.find(check => check.id === "operations")?.ready, true);
});
test("absent checklist data remains missing for every location", () => {
  const result = buildExecutiveReadiness({ ...completeInput, operationsLocationNames: [] });
  assert.equal(result.missingOperations, 2);
  assert.equal(result.checks.find(check => check.id === "operations")?.ready, false);
});
