import assert from "node:assert/strict";
import test from "node:test";
import { canEditPosition, defaultPermissions, hasPagePermission, permissionDefinitions, permissionForPath, positions, validatePermissions } from "./role-permissions.ts";

test("defaults retain current role boundaries and all checkbox values", () => {
  for (const role of positions) {
    const defaults = defaultPermissions(role);
    assert.equal(Object.keys(defaults).length, permissionDefinitions.length);
    assert.equal(defaults.administration, role === "tenant_admin");
    assert.equal(defaults.executive, role !== "salesperson");
    assert.equal(defaults.operations, true);
  }
});
test("only Admin can edit Admin; Manager edits own and Sales; Sales edits no position", () => {
  for (const target of positions) {
    assert.equal(canEditPosition("tenant_admin", target), true);
    assert.equal(canEditPosition("platform_owner", target), true);
    assert.equal(canEditPosition("manager", target), target !== "tenant_admin");
    assert.equal(canEditPosition("salesperson", target), false);
  }
});
test("forged submissions cannot exceed role or current Manager access", () => {
  const ceiling = { ...defaultPermissions("manager"), inventory: false };
  assert.equal(validatePermissions(defaultPermissions("salesperson"), "salesperson", "manager", ceiling), false);
  assert.equal(validatePermissions({ ...defaultPermissions("salesperson"), inventory: false }, "salesperson", "manager", ceiling), true);
  assert.equal(validatePermissions({ ...defaultPermissions("manager"), administration: true }, "manager", "manager", ceiling), false);
  assert.equal(validatePermissions({ ...defaultPermissions("manager"), administration: true }, "manager", "tenant_admin", defaultPermissions("tenant_admin")), false);
  assert.equal(validatePermissions({ ...defaultPermissions("manager"), unknown: true }, "manager", "tenant_admin", ceiling), false);
  assert.equal(validatePermissions({ ...defaultPermissions("manager"), inventory: "true" }, "manager", "tenant_admin", ceiling), false);
  assert.equal(validatePermissions(null, "manager", "tenant_admin", ceiling), false);
  assert.equal(validatePermissions(defaultPermissions("salesperson"), "salesperson", "manager", ceiling, defaultPermissions("salesperson")), true);
  assert.equal(validatePermissions(defaultPermissions("salesperson"), "salesperson", "manager", ceiling, { ...defaultPermissions("salesperson"), inventory: false }), false);
});
test("page and API aliases share permissions; role management stays accessible", () => {
  const denied = { ...defaultPermissions("manager"), sales_ai: false, inventory: false, operations: false };
  for (const path of ["/assistant", "/api/assistant", "/api/workspace-assistant/sales", "/products/123", "/api/product-documents/123/open", "/operations/handoffs", "/api/workspace-assistant/operations"]) assert.equal(hasPagePermission("manager", path, denied), false, path);
  assert.equal(hasPagePermission("manager", "/admin/settings/roles", denied), true);
  assert.equal(hasPagePermission("salesperson", "/admin/settings/roles"), true);
  assert.equal(hasPagePermission("manager", "/dashboard", denied), true);
  assert.equal(hasPagePermission("platform_owner", "/operations", denied), true);
  assert.equal(permissionForPath("/admin/settings/location-fees"), "administration");
  assert.equal(permissionForPath("/api/admin/platform/templates"), "administration");
});
