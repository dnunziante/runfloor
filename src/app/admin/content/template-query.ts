"use server";

import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_PAGE_SIZE, type ManagedContentType, type TemplateFilters, type TemplatePage } from "@/lib/content/template-pagination";

export async function getTemplatePage(filters: TemplateFilters): Promise<TemplatePage> {
  const empty: TemplatePage = { rows: [], total: 0, page: 1, error: "" };
  const viewer = await getViewer();
  if (!viewer?.organizationId || viewer.demo) return empty;
  if (!["sales_script", "objection_response", "email_template", "text_template"].includes(filters.contentType)) return { ...empty, error: "Invalid content type." };
  const supabase = await createClient();
  const page = Math.max(1, Math.floor(Number(filters.page) || 1));
  let query = supabase.from("sales_content_items")
    .select("id,title,objection,body,status,category,tags,updated_at", { count: "exact" })
    .eq("organization_id", viewer.organizationId)
    .eq("content_type", filters.contentType);
  if (filters.category && filters.category !== "All Templates" && filters.category !== "All Scripts") query = filters.category === "General" ? query.or("category.eq.General,category.is.null,category.eq.") : query.eq("category", filters.category);
  if (filters.tag && filters.tag !== "all") query = query.contains("tags", [filters.tag]);
  if (["draft", "published", "archived"].includes(filters.status)) query = query.eq("status", filters.status);
  const needle = filters.query.trim().slice(0, 120);
  if (needle) {
    const safe = needle.replace(/[(),.*%\\"]/g, " ").trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,objection.ilike.%${safe}%,body.ilike.%${safe}%,category.ilike.%${safe}%,tags.cs.{"${safe}"}`);
  }
  if (filters.sort === "az") query = query.order("title", { ascending: true }).order("id");
  else if (filters.sort === "za") query = query.order("title", { ascending: false }).order("id");
  else if (filters.sort === "oldest") query = query.order("updated_at", { ascending: true }).order("id");
  else if (filters.sort === "newest") query = query.order("created_at", { ascending: false }).order("id");
  else query = query.order("updated_at", { ascending: false }).order("id");
  const from = (page - 1) * TEMPLATE_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + TEMPLATE_PAGE_SIZE - 1);
  if (error) return { ...empty, error: "Templates could not be loaded." };
  const total = count ?? 0;
  if (from >= total && page > 1) return getTemplatePage({ ...filters, page: 1 });
  return { rows: (data ?? []).map((item) => ({ id: item.id, title: item.title, objection: item.objection || "", body: item.body, status: item.status as TemplatePage["rows"][number]["status"], category: item.category || "", tags: item.tags || [], updatedAt: item.updated_at })), total, page, error: "" };
}

export async function getTemplateFacets(contentType: ManagedContentType) {
  const viewer = await getViewer();
  if (!viewer?.organizationId || viewer.demo) return { categoryCounts: {} as Record<string, number>, tags: [] as string[], total: 0 };
  const supabase = await createClient();
  const categoryCounts: Record<string, number> = {};
  const tags = new Set<string>();
  let total = 0;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("sales_content_items").select("category,tags")
      .eq("organization_id", viewer.organizationId).eq("content_type", contentType)
      .order("id").range(offset, offset + 999);
    if (error) break;
    const rows = data ?? [];
    total += rows.length;
    for (const row of rows) {
      const category = row.category || "General";
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      for (const tag of row.tags || []) tags.add(tag);
    }
    if (rows.length < 1000) break;
  }
  return { categoryCounts, tags: [...tags].sort(), total };
}
