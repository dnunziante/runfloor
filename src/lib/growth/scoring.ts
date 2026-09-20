import "server-only";
import { getViewer } from "@/lib/auth/viewer";
import { growthOpportunities, rvGrowthOpportunities, growthScoreWeights, type GrowthScore, type GrowthScoreWeights } from "@/lib/growth/data";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { createClient } from "@/lib/supabase/server";

export async function getGrowthScoring() {
  const viewer = await getViewer();
  if (viewer?.demo) return { opportunities: viewer.organizationName === "RunFloor RV" ? rvGrowthOpportunities : growthOpportunities, weights: growthScoreWeights as GrowthScoreWeights, persistence: "demo" as const, canEdit: true, error: "" };
  if (!viewer) return { opportunities: [], weights: growthScoreWeights as GrowthScoreWeights, persistence: "supabase" as const, canEdit: false, error: "Sign in to view growth priorities." };
  const supabase = await createClient();
  const [{ data, error }, { data: opportunityRows, error: opportunityError }] = await Promise.all([supabase.from("growth_scoring_configs").select("weights, opportunity_scores").eq("organization_id", viewer.organizationId).maybeSingle(), supabase.from("growth_opportunities").select("slug,title,category,summary,rationale,impact_label,effort_label,timeframe,status,actions,measures,score").eq("organization_id", viewer.organizationId).eq("status", "published").order("created_at")]);
  const weights = (data?.weights ?? growthScoreWeights) as GrowthScoreWeights;
  const scores = (data?.opportunity_scores ?? {}) as Record<string, GrowthScore>;
  const persisted = (opportunityRows ?? []).map((row) => ({ slug: row.slug, title: row.title, category: row.category, summary: row.summary, rationale: row.rationale, impact: row.impact_label, effort: row.effort_label, timeframe: row.timeframe, status: "Ready to review" as const, actions: row.actions, measures: row.measures, score: scores[row.slug] ?? row.score, lifecycleStatus: "idea", progress: 0, dueDate: null })) as typeof growthOpportunities;
  const samples = await getViewerIndustryTemplateKey(viewer) === "rv" ? rvGrowthOpportunities : growthOpportunities;
  return { opportunities: persisted.length ? persisted : samples.map((item) => ({ ...item, score: scores[item.slug] ?? item.score })), weights, persistence: "supabase" as const, canEdit: viewer.role === "tenant_admin" || viewer.role === "platform_owner", error: error?.message ?? opportunityError?.message ?? "" };
}

export async function getAdminGrowthOpportunities() {
  const viewer = await getViewer(); if (viewer?.demo) return { opportunities: growthOpportunities.map((item)=>({...item,adminStatus:"published"})), persistence:"demo" as const, canEdit:true, error:"" };
  if (!viewer) return { opportunities: [], persistence: "supabase" as const, canEdit: false, error: "Sign in to manage growth opportunities." };
  const supabase=await createClient(); const {data,error}=await supabase.from("growth_opportunities").select("slug,title,category,summary,rationale,impact_label,effort_label,timeframe,status,actions,measures,score").eq("organization_id",viewer.organizationId).order("created_at");
  return {opportunities:(data??[]).map((row)=>({slug:row.slug,title:row.title,category:row.category,summary:row.summary,rationale:row.rationale,impact:row.impact_label,effort:row.effort_label,timeframe:row.timeframe,status:"Ready to review" as const,actions:row.actions,measures:row.measures,score:row.score,adminStatus:row.status})),persistence:"supabase" as const,canEdit:viewer.role==="tenant_admin"||viewer.role==="platform_owner",error:error?.message??""};
}
