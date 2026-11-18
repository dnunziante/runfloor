import "server-only";
import { isFreeSolo } from "@/lib/plans/policy";

import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function getViewerIndustryTemplateKey(viewer: Viewer) {
  if (viewer.demo) return viewer.organizationName === "RunFloor RV" ? "rv" : null;
  if (isFreeSolo(viewer.plan)) return "rv";
  const db = await createClient();
  // First authorize the organization through the signed-in client's existing RLS.
  const { data: organization } = await db.from("organizations").select("industry_template_id").eq("id", viewer.organizationId).maybeSingle();
  if (!organization?.industry_template_id) return null;
  // Templates are platform-managed. Only read the public type identifier for
  // the already-authorized workspace; never expose the template payload.
  const reader = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : db;
  const { data: template } = await reader.from("industry_templates").select("template_key").eq("id", organization.industry_template_id).maybeSingle();
  return template?.template_key ?? null;
}

export async function getViewerIndustryTemplateId(viewer: Viewer) {
  if (viewer.demo) return null;
  const db = await createClient();
  const { data } = await db.from("organizations").select("industry_template_id").eq("id", viewer.organizationId).maybeSingle();
  return data?.industry_template_id ?? null;
}
