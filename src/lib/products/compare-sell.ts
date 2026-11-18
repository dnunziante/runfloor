import type { Viewer } from "@/lib/auth/viewer";
import { hasPagePermission } from "@/lib/auth/role-permissions";
import { effectivePlanKey, isFreeSolo } from "@/lib/plans/policy";

export const comparisonActions = {
  pitch: "30-second pitch",
  objection: "Handle an objection",
  demo: "Plan a side-by-side demo",
} as const;

export type ComparisonAction = keyof typeof comparisonActions;

export function compareSellAccess(viewer: Viewer | null) {
  if (!viewer?.organizationId || viewer.demo) return { status: 401, message: "Sign in to a RunFloor workspace to use Compare & Sell." };
  if (isFreeSolo(viewer.plan)) return { status: 403, message: "Upgrade to Sales Solo to use Compare & Sell." };
  const plan = effectivePlanKey(viewer.plan);
  if (!["/assistant", "/comparisons"].every(path => hasPagePermission(viewer.role, path, viewer.permissions, plan))) {
    return { status: 403, message: "Your position needs access to both Sales AI and Comparisons." };
  }
  return null;
}
