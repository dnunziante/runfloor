import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { activeSidebarItem, getSidebarNavigation } from "./sidebar-navigation.ts";
import { activeNavigationItem, getWorkspaceNavigation } from "./navigation.ts";

test("all seven existing footer destinations remain unique and resolve to pages", () => {
  const items = getSidebarNavigation("platform_owner").flatMap(group => group.items);
  assert.deepEqual(items.map(item => item.href).sort(), ["/help", "/admin/opal", "/billing", "/ai-usage", "/admin/ai-billing", "/admin/settings", "/admin"].sort());
  for (const item of items) assert.ok(existsSync(`src/app${item.href}/page.tsx`), item.href);
});

test("existing role visibility is preserved", () => {
  for (const role of ["salesperson", "manager", "tenant_admin", "platform_owner"] as const) {
    const groups = getSidebarNavigation(role);
    const paths = groups.flatMap(group => group.items).map(item => item.href);
    assert.equal(paths.includes("/admin/opal"), role === "platform_owner");
    assert.equal(paths.includes("/admin/ai-billing"), role === "platform_owner");
    assert.equal(paths.includes("/admin/settings"), role === "platform_owner" || role === "tenant_admin");
    assert.equal(paths.includes("/admin"), role === "platform_owner" || role === "tenant_admin");
    assert.ok(groups.every(group => group.items.length));
  }
});

test("deep links select their parent without stealing primary admin destinations", () => {
  const groups = getSidebarNavigation("platform_owner");
  for (const path of ["/help", "/admin/opal", "/billing", "/ai-usage", "/admin/ai-billing", "/admin/settings"]) {
    assert.equal(activeSidebarItem(`${path}/details`, groups)?.href, path);
  }
  assert.equal(activeSidebarItem("/admin", groups)?.href, "/admin");
  assert.equal(activeSidebarItem("/dashboard", groups), undefined);
  assert.equal(activeSidebarItem("/admin/users", groups)?.href, "/admin");
  const path = "/admin/executive/setup";
  const primaryItem = activeNavigationItem(path, getWorkspaceNavigation("platform_owner"));
  assert.equal(primaryItem ? undefined : activeSidebarItem(path, groups), undefined);
});
