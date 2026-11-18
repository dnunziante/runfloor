import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccountPlan } from "./policy";
export type SoloSummary = AccountPlan & { used_units: number; reserved_units: number; remaining_units: number; user_count: number };
export async function getSoloSummary(organizationId: string): Promise<SoloSummary | null> {
  const db = await createClient();
  const { data, error } = await db.rpc("sales_solo_summary", { target_org: organizationId });
  if (error) throw new Error("Sales Solo usage could not be verified.");
  return data;
}
