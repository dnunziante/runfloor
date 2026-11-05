import assert from "node:assert/strict";
import test from "node:test";
import { ENABLE_SALES_COACHING, isFeatureDestinationEnabled, isSalesCoachingPath } from "./features.ts";
import { getWorkspaceNavigation } from "./navigation.ts";

const coachingPages = ["/coach", "/training", "/objections", "/coach/scenarios", "/role-play", "/coach/session?scenario=product-fit", "/coach/review", "/coach/development", "/training/lesson-a/preview", "/training/lesson-a/review", "/admin/coach", "/admin/training"];

test("Sales Coaching defaults to disabled, including nested, legacy and management destinations", () => {
  assert.equal(ENABLE_SALES_COACHING, false);
  for (const path of coachingPages) { assert.ok(isSalesCoachingPath(path), path); assert.equal(isFeatureDestinationEnabled(path), false, path); }
  for (const path of ["/api/coach/session", "/api/coach/personas", "/api/admin/coach/scenario-import", "/api/knowledge/documents/id/training"]) assert.equal(isFeatureDestinationEnabled(path), false, path);
});

test("the restriction preserves Sales AI, messaging, products, quotes, knowledge and business tools", () => {
  for (const path of ["/assistant", "/api/assistant", "/messages", "/products", "/comparisons", "/competitors", "/pricing-calculator", "/quote-calculator", "/knowledge-base", "/api/knowledge/documents", "/operations", "/executive", "/coach-tools-unrelated"]) assert.equal(isFeatureDestinationEnabled(path), true, path);
});

test("all seven links and their heading disappear for every role and tenant template", () => {
  for (const role of ["salesperson", "manager", "tenant_admin", "platform_owner"] as const) for (const industry of [undefined, "rv", "golf-cart", "other"]) {
    const navigation = getWorkspaceNavigation(role, industry);
    assert.equal(navigation.flatMap((workspace) => workspace.groups).some((group) => group.label === "Sales Coaching"), false);
    assert.ok(navigation.flatMap((workspace) => workspace.groups.flatMap((group) => group.items)).every((item) => !isSalesCoachingPath(item.href)));
    assert.ok(navigation[0].groups.flatMap((group) => group.items).some((item) => item.href === "/assistant"));
  }
});

test("reenabling the one flag restores the complete seven-link coaching group", () => {
  const navigation = getWorkspaceNavigation("tenant_admin", "golf-cart", true);
  const coaching = navigation[0].groups.find((group) => group.label === "Sales Coaching");
  assert.deepEqual(coaching?.items.map((item) => item.label), ["Coach Dashboard", "Training", "Objection Handling", "Practice Scenarios", "Role Play", "Session Review", "My Development"]);
  for (const path of coachingPages) assert.equal(isFeatureDestinationEnabled(path, true), true);
});
