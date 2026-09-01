import "server-only";

import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export type OrganizationSettings = { displayName: string; primaryColor: string; contactEmail: string; defaultLocationId: string; assistantInstructions: string; communicationRules: string };

export const defaultOrganizationSettings: OrganizationSettings = {
  displayName: "BGC", primaryColor: "#0B5CFF", contactEmail: "", defaultLocationId: "",
  assistantInstructions: "Use approved product information and never invent pricing or availability. Answer the immediate question first; ask a discovery question only when it is needed to give a useful answer.",
  communicationRules: "Use a confident, helpful tone. Ask a useful discovery question when appropriate and never make unsupported claims.",
};

export async function getOrganizationSettings(): Promise<OrganizationSettings> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || !viewer.organizationId) return defaultOrganizationSettings;
  const supabase = await createClient();
  const { data } = await supabase.from("organization_settings").select("display_name, primary_color, contact_email, default_location_id, assistant_instructions, communication_rules").eq("organization_id", viewer.organizationId).maybeSingle();
  if (!data) return { ...defaultOrganizationSettings, displayName: viewer.organizationName };
  return { displayName: data.display_name, primaryColor: data.primary_color, contactEmail: data.contact_email || "", defaultLocationId: data.default_location_id || "", assistantInstructions: data.assistant_instructions, communicationRules: data.communication_rules || data.assistant_instructions || "" };
}
