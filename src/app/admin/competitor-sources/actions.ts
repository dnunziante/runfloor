"use server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export async function addCompetitorSource(formData: FormData) {
  const viewer = await getViewer(); if (!viewer?.organizationId || !["tenant_admin", "platform_owner", "manager"].includes(viewer.role)) throw new Error("Unauthorized");
  const competitorName = String(formData.get("competitorName") || "").trim(); const sourceUrl = String(formData.get("sourceUrl") || "").trim();
  try { const url = new URL(sourceUrl); if (!/^https?:$/.test(url.protocol)) throw new Error(); } catch { throw new Error("Enter a valid public http or https URL."); }
  if (competitorName.length < 2) throw new Error("Enter a competitor name."); const supabase = await createClient(); const { error } = await supabase.from("competitor_sources").insert({ organization_id: viewer.organizationId, competitor_name: competitorName, source_url: sourceUrl, source_type: "manufacturer_website", created_by: viewer.id }); if (error) throw new Error("This source could not be saved. It may already exist."); revalidatePath("/admin/competitor-sources");
}

export async function deleteCompetitorSource(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer?.organizationId || !["tenant_admin", "platform_owner", "manager"].includes(viewer.role)) throw new Error("Unauthorized");
  const sourceId = String(formData.get("sourceId") || "");
  if (!/^[0-9a-f-]{36}$/i.test(sourceId)) throw new Error("Invalid source.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("competitor_sources")
    .delete()
    .eq("id", sourceId)
    .eq("organization_id", viewer.organizationId);

  if (error) throw new Error("The competitor source could not be deleted.");
  revalidatePath("/admin/competitor-sources");
  revalidatePath("/admin/competitor-sources/review");
}
