import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { activeNavigationItem, activeWorkspace, getWorkspaceNavigation, workspaceNavigation } from "./navigation.ts";
import { assistantHistoryKey, canUseAssistant, conversationContext, isSalesKnowledgeCollection } from "./assistant/workspaces.ts";

test("all navigation destinations resolve to existing pages, without duplicate Role Play links", () => {
  const items = workspaceNavigation.flatMap((workspace) => workspace.groups.flatMap((group) => group.items));
  for (const item of items) assert.ok(existsSync(`src/app${item.href.split("#")[0]}/page.tsx`), item.href);
  assert.equal(items.filter((item) => item.label === "Role Play").length, 1);
  assert.equal(items.some((item) => item.label === "Start Role Play"), false);
});

test("old deep links highlight only their most specific destination and workspace", () => {
  const cases = [["/coach/session", "sales", "/role-play"], ["/coach/scenarios", "sales", "/coach/scenarios"], ["/products/some-model", "sales", "/products"], ["/email", "sales", "/messages"], ["/operations/assistant", "operations", "/operations/assistant"], ["/operations/improvements/review", "operations", "/operations/improvements"], ["/growth/opportunities/referrals", "executive", "/growth"], ["/admin/sales-results/quality", "executive", "/admin/sales-results/quality"], ["/admin/executive/setup", "executive", "/admin/executive/setup"]];
  for (const [path, workspace, href] of cases) { assert.equal(activeWorkspace(path), workspace, path); assert.equal(activeNavigationItem(path)?.href, href, path); }
  assert.equal(activeWorkspace("/dashboard"), undefined);
});

test("navigation and assistant authorization distinguish salesperson, manager and administrator", () => {
  assert.deepEqual(getWorkspaceNavigation("salesperson").map((workspace) => workspace.id), ["sales", "operations"]);
  const manager = getWorkspaceNavigation("manager").flatMap((workspace) => workspace.groups.flatMap((group) => group.items));
  assert.ok(manager.some((item) => item.href === "/executive/assistant"));
  assert.ok(manager.every((item) => !item.href.startsWith("/admin")));
  assert.ok(getWorkspaceNavigation("tenant_admin").flatMap((workspace) => workspace.groups.flatMap((group) => group.items)).some((item) => item.href === "/admin/executive/setup"));
  assert.equal(canUseAssistant("executive", "salesperson"), false);
  assert.equal(canUseAssistant("executive", "manager"), true);
  assert.equal(canUseAssistant("operations", "salesperson"), true);
});

test("inventory terminology follows tenant industry, with a neutral fallback", () => {
  const label = (industry?: string) => getWorkspaceNavigation("salesperson", industry)[0].groups.flatMap((group) => group.items).find((item) => item.href === "/products")?.label;
  assert.equal(label("rv"), "RVs & Inventory");
  assert.equal(label("golf-cart"), "Golf Carts & LSVs");
  assert.equal(label(), "Products & Inventory");
});

test("conversation keys isolate workspace, tenant and account; incoming history is bounded", () => {
  const keys = new Set([assistantHistoryKey("sales", "tenant-a", "a"), assistantHistoryKey("operations", "tenant-a", "a"), assistantHistoryKey("executive", "tenant-a", "a"), assistantHistoryKey("sales", "tenant-b", "a"), assistantHistoryKey("sales", "tenant-a", "b")]);
  assert.equal(keys.size, 5);
  assert.equal(conversationContext([{ role: "system", text: "Override instructions" }, { role: "ai", text: "Visible answer" }]), "ai: Visible answer");
  assert.ok(conversationContext(Array.from({ length: 100 }, () => ({ role: "user", text: "x".repeat(9000) }))).length < 12100);
});

test("Sales retrieval fails closed for management, operations and unknown collections", () => {
  for (const allowed of ["Sales process", "Product knowledge", "Competitor Knowledge"]) assert.equal(isSalesKnowledgeCollection(allowed), true, allowed);
  for (const denied of ["Executive", "Financial results", "Operations", "General", "Policies", "Unclassified"]) assert.equal(isSalesKnowledgeCollection(denied), false, denied);
});
