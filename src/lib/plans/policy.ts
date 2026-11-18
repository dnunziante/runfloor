import type { RolePermissions } from "../auth/role-permissions";

export const SALES_SOLO = { key: "sales_solo", name: "RunFloor Sales Solo", priceCents: 2500, seatLimit: 1, aiCostUnits: 500_000_000 } as const;
export type AccountPlan = {
  organization_id: string; owner_user_id: string; plan_key: "sales_solo" | "complete";
  status: string; paid_start: string | null; paid_until: string | null; cancel_at: string | null;
  stripe_customer_id: string | null; stripe_subscription_id: string | null;
  stripe_account_id: string | null; livemode: boolean | null; checkout_session_id: string | null;
  seat_limit: number; ai_limit_units: number; access_override_until: string | null;
};
export function planPaid(plan: AccountPlan, now = Date.now()) {
  return (!!plan.access_override_until && Date.parse(plan.access_override_until) > now) ||
    (["active", "past_due"].includes(plan.status) && !!plan.paid_start && Date.parse(plan.paid_start) <= now && !!plan.paid_until && Date.parse(plan.paid_until) > now);
}
const under = (path: string, root: string) => path === root || path.startsWith(`${root}/`);
export function soloAllowsPath(raw: string) {
  const path = raw.split(/[?#]/)[0];
  if (/^\/api\/knowledge\/documents\/[^/]+\/training(?:\/|$)/.test(path)) return false;
  if (["/dashboard", "/admin/settings"].includes(path)) return true;
  return ["/billing", "/ai-usage", "/help", "/assistant", "/products", "/competitors", "/comparisons", "/messages", "/email", "/text", "/generator", "/knowledge", "/knowledge-base", "/pricing-calculator", "/quote-calculator", "/analytics", "/dashboard/performance", "/admin/products", "/admin/competitors", "/admin/content", "/api/admin/content/text-template-import", "/api/products", "/api/product-documents", "/api/competitor-sources", "/api/knowledge/documents", "/api/assistant", "/api/email-generator", "/api/text-generator", "/api/message-templates", "/api/workspace-assistant/sales", "/api/opal", "/api/auth"].some(root => under(path, root));
}
export const soloPermissions: RolePermissions = {
  sales_ai: true, inventory: true, comparisons: true, messages: true, knowledge: true, calculator: true, sales_reports: true,
  coaching: false, operations: false, executive: false, billing: true, administration: false,
};
export function limitPermissions(permissions: RolePermissions): RolePermissions {
  return Object.fromEntries(Object.entries(permissions).map(([key, value]) => [key, value && soloPermissions[key as keyof RolePermissions]])) as RolePermissions;
}
