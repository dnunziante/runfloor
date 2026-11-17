import "server-only";

import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export type OrganizationLocation = { id: string; name: string; city: string; state: string; sortOrder: number; tpDestinationFee: number; rrDestinationFee: number; deliveryFee: number; salesTaxRate: number };

export const demoLocations: OrganizationLocation[] = [
  { id: "demo-charleston", name: "Charleston", city: "Charleston", state: "SC", sortOrder: 1, tpDestinationFee: 0, rrDestinationFee: 0, deliveryFee: 0, salesTaxRate: 0 },
  { id: "demo-summerville", name: "Summerville", city: "Summerville", state: "SC", sortOrder: 2, tpDestinationFee: 0, rrDestinationFee: 0, deliveryFee: 0, salesTaxRate: 0 },
];

export async function getOrganizationLocations(): Promise<{ locations: OrganizationLocation[]; error: string }> {
  const viewer = await getViewer();
  if (viewer?.demo) return { locations: demoLocations, error: "" };
  if (!viewer) return { locations: [], error: "Sign in to view organization locations." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("locations").select("id, name, city, state, sort_order, tp_destination_fee_cents, rr_destination_fee_cents, delivery_fee_cents, sales_tax_rate").eq("organization_id", viewer.organizationId).eq("is_active", true).order("sort_order").order("name");
  return { locations: (data ?? []).map((row) => ({ id: row.id, name: row.name, city: row.city || "", state: row.state || "", sortOrder: row.sort_order, tpDestinationFee: row.tp_destination_fee_cents / 100, rrDestinationFee: row.rr_destination_fee_cents / 100, deliveryFee: row.delivery_fee_cents / 100, salesTaxRate: Number(row.sales_tax_rate) })), error: error?.message ?? "" };
}

export async function validateWorkspaceLocation(name: string): Promise<string> {
 const result = await getOrganizationLocations();
 if (result.error) return "Workspace locations could not be loaded. Try again before saving.";
 return name === "All locations" || result.locations.some(location => location.name === name) ? "" : "Choose an active location in this workspace. Older records have not been changed.";
}
