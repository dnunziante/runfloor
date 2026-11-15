import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { LocationBilling } from "./policy";

export const canManageBilling = (viewer: Viewer) => !viewer.demo && ["platform_owner", "tenant_admin"].includes(viewer.role);
export async function getLocationBilling(viewer: Viewer) {
  if (viewer.demo || !viewer.organizationId) return [];
  const db = await createClient();
  const { data, error } = await db.rpc("get_rv_billing_rows", { target_org: viewer.organizationId });
  // Existing organizations have no billing row and retain their established access.
  if (error) {
    if (process.env.RUNFLOOR_RV_BILLING_ENABLED !== "true" && error.code === "PGRST202") return [];
    throw new Error("Billing information is temporarily unavailable.");
  }
  return (data ?? []) as LocationBilling[];
}
export async function selectedBilling(viewer: Viewer) {
  const rows = await getLocationBilling(viewer);
  const selected = (await cookies()).get("rf-billing-location")?.value;
  if (selected) return rows.find(row => row.location_id === selected) ?? null;
  return rows.length === 1 ? rows[0] : null;
}
