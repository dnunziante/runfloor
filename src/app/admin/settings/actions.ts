"use server";
import { isSoloPlan } from "@/lib/plans/policy";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export type OrganizationSettingsActionState = { error: string; success: string };
export type AddLocationState = { error: string; success: string };

const option = (value: FormDataEntryValue | null, allowed: string[], fallback: string) => typeof value === "string" && allowed.includes(value) ? value : fallback;
export async function saveAICommunicationStandards(_previousState: OrganizationSettingsActionState, formData: FormData): Promise<OrganizationSettingsActionState> {
  const viewer = await getViewer();
  if (isSoloPlan(viewer?.plan?.plan_key) && viewer.role !== "platform_owner") return { error: "Sales Solo includes self-service profile settings only.", success: "" };
  if (!viewer?.organizationId || viewer.demo || !["tenant_admin", "platform_owner"].includes(viewer.role)) return { error: "Tenant administrator access is required.", success: "" };
  const advanced = String(formData.get("advancedInstructions") || "").trim();
  if (advanced.length > 12000) return { error: "Advanced instructions must be 12,000 characters or fewer.", success: "" };
  const supabase = await createClient();
  const { error } = await supabase.from("organization_settings").update({
    ai_tone: option(formData.get("tone"), ["professional","conversational","friendly","direct","consultative"], "conversational"),
    ai_response_length: option(formData.get("responseLength"), ["concise","balanced","detailed"], "balanced"),
    ai_sales_approach: option(formData.get("salesApproach"), ["consultative","educational","direct","relationship_focused"], "consultative"),
    ai_discovery_level: option(formData.get("discoveryLevel"), ["minimal","moderate","thorough"], "moderate"),
    ai_competitor_behavior: option(formData.get("competitorBehavior"), ["do_not_discuss","when_asked","when_helpful"], "when_asked"),
    ai_cta_strength: option(formData.get("ctaStrength"), ["soft","balanced","strong"], "balanced"),
    ai_formatting: { shortParagraphs: formData.has("useShortParagraphs"), bullets: formData.has("useBullets"), headings: formData.has("useHeadings"), avoidLargeBlocks: formData.has("avoidLargeBlocks") },
    ai_recommendation_behavior: { askDiscoveryBeforeRecommendation: formData.has("askDiscoveryBeforeRecommendation"), explainRecommendation: formData.has("explainRecommendation"), offerAlternative: formData.has("offerAlternative"), connectBenefits: formData.has("connectBenefits") },
    ai_advanced_instructions: advanced, updated_at: new Date().toISOString(),
  }).eq("organization_id", viewer.organizationId);
  if (error) return { error: "AI Communication Standards could not be saved.", success: "" };
  revalidatePath("/admin/ai-communication"); return { error: "", success: "AI Communication Standards were saved for this organization." };
}

export async function saveOrganizationSettings(_previousState: OrganizationSettingsActionState, formData: FormData): Promise<OrganizationSettingsActionState> {
  const viewer = await getViewer();
  if (isSoloPlan(viewer?.plan?.plan_key) && viewer.role !== "platform_owner") return { error: "Sales Solo includes self-service profile settings only.", success: "" };
  if (!viewer?.organizationId || viewer.demo || !["tenant_admin", "platform_owner"].includes(viewer.role)) return { error: "Sign in as a tenant administrator to save shared settings.", success: "" };
  const displayName = String(formData.get("displayName") || "").trim();
  const primaryColor = String(formData.get("primaryColor") || "").trim();
  const contactEmail = String(formData.get("contactEmail") || "").trim();
  const defaultLocationId = String(formData.get("defaultLocationId") || "");
  if (displayName.length < 2 || displayName.length > 120 || !/^#[0-9A-Fa-f]{6}$/.test(primaryColor) || (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail)) || (defaultLocationId && !/^[0-9a-f-]{36}$/i.test(defaultLocationId))) return { error: "Enter a company name, a six-digit color such as #0B5CFF, a valid email, and a valid location.", success: "" };
  const supabase = await createClient();
  if (defaultLocationId) {
    const { data: location } = await supabase.from("locations").select("id").eq("id", defaultLocationId).eq("organization_id", viewer.organizationId).maybeSingle();
    if (!location) return { error: "Choose a location from this organization.", success: "" };
  }
  const { error } = await supabase.from("organization_settings").upsert({ organization_id: viewer.organizationId, display_name: displayName, primary_color: primaryColor, contact_email: contactEmail || null, default_location_id: defaultLocationId || null, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
  if (error) return { error: "Settings could not be saved to the shared workspace.", success: "" };
  revalidatePath("/admin/settings");
  return { error: "", success: "Settings were saved to the shared workspace." };
}

export async function saveLocationQuoteFees(formData: FormData) {
  const viewer = await getViewer();
  if (isSoloPlan(viewer?.plan?.plan_key) && viewer.role !== "platform_owner") throw new Error("Only the Platform Admin manages Sales Solo locations.");
  if (!viewer?.organizationId || !["tenant_admin", "platform_owner"].includes(viewer.role)) throw new Error("Unauthorized");
  const locationId = String(formData.get("locationId") || "");
  const locationName = String(formData.get("locationName") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const state = String(formData.get("state") || "").trim().toUpperCase();
  const salesTaxRate = Number(formData.get("salesTaxRate"));
  if (!/^[0-9a-f-]{36}$/i.test(locationId) || locationName.length < 2 || locationName.length > 120 || city.length > 120 || state.length > 40 || !Number.isFinite(salesTaxRate) || salesTaxRate < 0 || salesTaxRate > 100) throw new Error("Enter a location name, valid optional city/state details, and a tax rate from 0 to 100.");
  const supabase = await createClient();
  const { error } = await supabase.from("locations").update({ name: locationName, city: city || null, state: state || null, sales_tax_rate: salesTaxRate }).eq("id", locationId).eq("organization_id", viewer.organizationId);
  if (error) throw new Error(error.code === "23505" ? "A BGC location with that name already exists." : "Location details and quote defaults could not be saved.");
  revalidatePath("/admin/settings");
  revalidatePath("/quote-calculator");
  revalidatePath("/pricing-calculator");
  revalidatePath("/admin/users");
}

export async function addLocation(_previousState: AddLocationState, formData: FormData): Promise<AddLocationState> {
  const viewer = await getViewer();
  if (isSoloPlan(viewer?.plan?.plan_key) && viewer.role !== "platform_owner") return { error: "Sales Solo includes self-service profile settings only.", success: "" };
  if (!viewer?.organizationId || viewer.demo || !["tenant_admin", "platform_owner"].includes(viewer.role)) {
    return { error: "Only an Admin can add BGC locations.", success: "" };
  }
  const name = String(formData.get("name") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const state = String(formData.get("state") || "").trim().toUpperCase();
  if (name.length < 2 || name.length > 120 || city.length > 120 || state.length > 40) {
    return { error: "Enter a location name and optional city/state details.", success: "" };
  }
  const supabase = await createClient();
  const { data: lastLocation } = await supabase.from("locations").select("sort_order").eq("organization_id", viewer.organizationId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("locations").insert({
    organization_id: viewer.organizationId,
    name,
    city: city || null,
    state: state || null,
    is_active: true,
    sort_order: (lastLocation?.sort_order || 0) + 1,
  });
  if (error) {
    return { error: error.code === "23505" ? "A BGC location with that name already exists." : "The location could not be saved to the shared workspace.", success: "" };
  }
  revalidatePath("/admin/settings");
  revalidatePath("/admin/users");
  return { error: "", success: `${name} was added to the shared BGC workspace.` };
}

export async function reorderLocations(locationIds: string[]): Promise<{ error: string }> {
  const viewer = await getViewer();
  if (isSoloPlan(viewer?.plan?.plan_key) && viewer.role !== "platform_owner") throw new Error("Only the Platform Admin manages Sales Solo locations.");
  if (!viewer?.organizationId || viewer.demo || !["tenant_admin", "platform_owner"].includes(viewer.role)) {
    return { error: "Only an Admin can reorder BGC locations." };
  }
  if (!Array.isArray(locationIds) || locationIds.length === 0 || new Set(locationIds).size !== locationIds.length || locationIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
    return { error: "The location order is invalid." };
  }
  const supabase = await createClient();
  const { data: locations, error: readError } = await supabase.from("locations").select("id").eq("organization_id", viewer.organizationId).eq("is_active", true);
  if (readError || locations?.length !== locationIds.length || locations.some((location) => !locationIds.includes(location.id))) {
    return { error: "The location list has changed. Refresh and try again." };
  }
  const results = await Promise.all(locationIds.map((id, index) => supabase.from("locations").update({ sort_order: index + 1 }).eq("id", id).eq("organization_id", viewer.organizationId)));
  if (results.some((result) => result.error)) return { error: "The location order could not be saved." };
  revalidatePath("/admin/settings/location-fees");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/users");
  revalidatePath("/quote-calculator");
  revalidatePath("/pricing-calculator");
  return { error: "" };
}
