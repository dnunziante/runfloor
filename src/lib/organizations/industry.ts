import "server-only";

import type { Viewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export async function getViewerIndustryTemplateKey(viewer: Viewer) {
  if (viewer.demo) return viewer.organizationName === "RunFloor RV" ? "rv" : null;
  const db = await createClient();
  const { data } = await db
    .from("organizations")
    .select("industry_template:industry_templates!organizations_industry_template_id_fkey(template_key)")
    .eq("id", viewer.organizationId)
    .maybeSingle();
  const template = data?.industry_template as unknown as { template_key?: string } | null;
  return template?.template_key ?? null;
}
