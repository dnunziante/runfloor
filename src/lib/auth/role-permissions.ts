import type { AppRole } from "./viewer";

export const positions = ["tenant_admin", "manager", "salesperson"] as const;
export type Position = typeof positions[number];
export const positionLabels = { tenant_admin: "Admin", manager: "Manager", salesperson: "Sales" };
const all = positions;
const leadership = ["tenant_admin", "manager"] as const;
const admin = ["tenant_admin"] as const;
export const permissionDefinitions = [
  { key: "sales_ai", label: "Sales AI Assistant", section: "Sales", roles: all },
  { key: "inventory", label: "Products & Inventory", section: "Sales", roles: all },
  { key: "comparisons", label: "Competitors & Comparisons", section: "Sales", roles: all },
  { key: "messages", label: "Message Center", section: "Sales", roles: all },
  { key: "knowledge", label: "Knowledge Base", section: "Sales", roles: all },
  { key: "calculator", label: "Quote & Loan Calculator", section: "Sales", roles: all },
  { key: "sales_reports", label: "Sales Dashboard & Analytics", section: "Sales", roles: all },
  { key: "coaching", label: "Sales Coaching & Training", section: "Sales", roles: all },
  { key: "operations", label: "Operations workspace", section: "Workspaces", roles: all },
  { key: "executive", label: "Executive workspace", section: "Workspaces", roles: leadership },
  { key: "billing", label: "Subscription, Billing & AI Usage", section: "Administration", roles: all },
  { key: "administration", label: "Team, Content & Company Administration", section: "Administration", roles: admin },
] as const;
export type PermissionKey = typeof permissionDefinitions[number]["key"];
export type RolePermissions = Record<PermissionKey, boolean>;
export type PermissionMatrix = Record<Position, { permissions: RolePermissions; revision: number }>;

export function defaultPermissions(role: AppRole): RolePermissions {
  return Object.fromEntries(permissionDefinitions.map(p => [p.key, role === "platform_owner" || (p.roles as readonly string[]).includes(role)])) as RolePermissions;
}
export function defaultPermissionMatrix(): PermissionMatrix {
  return Object.fromEntries(positions.map(role => [role, { permissions: defaultPermissions(role), revision: 0 }])) as PermissionMatrix;
}
export function canEditPosition(actor: AppRole, target: Position) {
  return actor === "platform_owner" || actor === "tenant_admin" || (actor === "manager" && target !== "tenant_admin");
}
export function validatePermissions(value: unknown, target: Position, actor: AppRole, ceiling: RolePermissions, previous?: RolePermissions): value is RolePermissions {
  if (!canEditPosition(actor, target) || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).length === permissionDefinitions.length && permissionDefinitions.every(p =>
    typeof candidate[p.key] === "boolean" && (!candidate[p.key] || (defaultPermissions(target)[p.key] && (actor !== "manager" || ceiling[p.key] || previous?.[p.key])))
  );
}
const matches = (path: string, root: string) => path === root || path.startsWith(`${root}/`);
export function permissionForPath(path: string): PermissionKey | undefined {
  // Role management is governed by its own immutable hierarchy, so Admins cannot lock themselves out.
  if (matches(path, "/admin/settings/roles") || matches(path, "/api/auth") || matches(path, "/api/opal") || matches(path, "/admin/opal") || matches(path, "/admin/ai-billing")) return undefined;
  if (matches(path, "/admin") || matches(path, "/api/admin")) return "administration";
  if (matches(path, "/executive") || matches(path, "/growth") || matches(path, "/api/workspace-assistant/executive")) return "executive";
  if (matches(path, "/operations") || matches(path, "/api/workspace-assistant/operations")) return "operations";
  if (matches(path, "/billing") || matches(path, "/ai-usage")) return "billing";
  if (["/assistant", "/api/assistant", "/api/workspace-assistant/sales"].some(p => matches(path, p))) return "sales_ai";
  if (["/products", "/api/products", "/api/product-documents"].some(p => matches(path, p))) return "inventory";
  if (["/competitors", "/comparisons", "/api/competitor-sources"].some(p => matches(path, p))) return "comparisons";
  if (["/messages", "/email", "/text", "/generator", "/api/email-generator", "/api/text-generator", "/api/message-templates"].some(p => matches(path, p))) return "messages";
  if (["/knowledge", "/knowledge-base", "/api/knowledge"].some(p => matches(path, p))) return "knowledge";
  if (["/pricing-calculator", "/quote-calculator"].some(p => matches(path, p))) return "calculator";
  if (matches(path, "/analytics") || matches(path, "/dashboard/performance")) return "sales_reports";
  if (["/coach", "/training", "/role-play", "/objections", "/api/coach"].some(p => matches(path, p))) return "coaching";
  return undefined;
}
export function hasPagePermission(role: AppRole, path: string, permissions?: RolePermissions) {
  if (role === "platform_owner") return true;
  const key = permissionForPath(path.split("#")[0]);
  return !key || Boolean((permissions ?? defaultPermissions(role))[key]);
}
