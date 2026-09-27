import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { TEMPLATE_PAGE_SIZE } from "@/lib/content/template-pagination";
import { createClient } from "@/lib/supabase/server";
import { getViewerIndustryTemplateId } from "@/lib/organizations/industry";

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.organizationId || viewer.demo) return NextResponse.json({ rows: [], categories: [], total: 0, page: 1 });
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind !== "email" && kind !== "text") return NextResponse.json({ error: "Choose email or text templates." }, { status: 400 });
  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1);
  const search = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 120).replace(/[(),.*%\\"]/g, " ").trim();
  const category = (request.nextUrl.searchParams.get("category") || "").trim().slice(0, 120);
  const db = await createClient();
  const industryTemplateId = await getViewerIndustryTemplateId(viewer);
  const scope = industryTemplateId ? `organization_id.eq.${viewer.organizationId},industry_template_id.eq.${industryTemplateId}` : `organization_id.eq.${viewer.organizationId}`;
  let query = db.from("sales_content_items")
    .select("id,title,body,category,tags,updated_at", { count: "exact" })
    .or(scope)
    .eq("content_type", kind === "email" ? "email_template" : "text_template")
    .eq("status", "published");
  if (category) query = query.eq("category", category);
  if (search) query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%,category.ilike.%${search}%,tags.cs.{"${search}"}`);
  const from = (page - 1) * TEMPLATE_PAGE_SIZE;
  const [{ data, count, error }, { data: facetRows }] = await Promise.all([
    query.order("updated_at", { ascending: false }).order("id").range(from, from + TEMPLATE_PAGE_SIZE - 1),
    db.from("sales_content_items").select("category").or(scope).eq("content_type", kind === "email" ? "email_template" : "text_template").eq("status", "published").order("category"),
  ]);
  if (error) return NextResponse.json({ error: "Templates could not be loaded." }, { status: 500 });
  const rows = (data || []).map((item) => ({ id: item.id, title: item.title, body: item.body, category: item.category || "General", tags: item.tags || [], updatedAt: item.updated_at }));
  const categories = [...new Set((facetRows || []).map((item) => item.category || "General"))];
  return NextResponse.json({ rows, categories, total: count || 0, page });
}
