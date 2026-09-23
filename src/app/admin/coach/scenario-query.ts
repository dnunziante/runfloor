"use server";

import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { toScenario, type ScenarioRow } from "@/lib/coach/data";
import type { CoachScenario } from "@/lib/coach/types";

const SCENARIO_PAGE_SIZE = 100;
export type ScenarioFilters = { category: string; difficulty: string; tag: string; status: string; sort: string; query: string; page: number };
export type ScenarioPage = { rows: CoachScenario[]; total: number; page: number; error: string };

export async function getScenarioPage(filters: ScenarioFilters): Promise<ScenarioPage> {
  const empty: ScenarioPage = { rows: [], total: 0, page: 1, error: "" };
  const viewer = await getViewer();
  if (!viewer?.organizationId || viewer.demo) return empty;
  const supabase = await createClient();
  const page = Math.max(1, Math.floor(Number(filters.page) || 1));
  let query = supabase.from("coach_scenarios").select("id,slug,title,category,difficulty,duration_minutes,customer_persona,goal,opening,skills,tags,response_options,preferred_option_indices,rubric_weights,status,updated_at,coach_scenario_rounds(id,round_number,customer_prompt,response_options,preferred_option_indices,skill_impacts)", { count: "exact" }).eq("organization_id", viewer.organizationId);
  if (filters.category && filters.category !== "All Scenarios") query = query.eq("category", filters.category);
  if (["Foundational", "Intermediate", "Advanced"].includes(filters.difficulty)) query = query.eq("difficulty", filters.difficulty);
  if (filters.tag && filters.tag !== "all") query = query.contains("tags", [filters.tag]);
  if (["draft", "published", "archived"].includes(filters.status)) query = query.eq("status", filters.status);
  const safe = filters.query.trim().slice(0, 120).replace(/[(),.*%\\"]/g, " ").trim();
  if (safe) query = query.or(`title.ilike.%${safe}%,category.ilike.%${safe}%,customer_persona.ilike.%${safe}%,goal.ilike.%${safe}%,opening.ilike.%${safe}%,tags.cs.{"${safe}"}`);
  if (filters.sort === "az") query = query.order("title", { ascending: true }).order("id");
  else if (filters.sort === "difficulty") query = query.order("difficulty").order("title");
  else if (filters.sort === "oldest") query = query.order("updated_at", { ascending: true }).order("id");
  else query = query.order("updated_at", { ascending: false }).order("id");
  const from = (page - 1) * SCENARIO_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + SCENARIO_PAGE_SIZE - 1);
  if (error) return { ...empty, error: "Practice scenarios could not be loaded." };
  const total = count || 0;
  if (from >= total && page > 1) return getScenarioPage({ ...filters, page: 1 });
  return { rows: (data as ScenarioRow[]).map(toScenario), total, page, error: "" };
}

export async function getScenarioFacets() {
  const viewer = await getViewer();
  if (!viewer?.organizationId || viewer.demo) return { total: 0, categoryCounts: {} as Record<string, number>, tags: [] as string[] };
  const supabase = await createClient();
  const categoryCounts: Record<string, number> = {}; const tags = new Set<string>(); let total = 0;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("coach_scenarios").select("category,tags").eq("organization_id", viewer.organizationId).order("id").range(offset, offset + 999);
    if (error) break;
    const rows = data || []; total += rows.length;
    for (const row of rows) { categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1; for (const tag of row.tags || []) tags.add(tag); }
    if (rows.length < 1000) break;
  }
  return { total, categoryCounts, tags: [...tags].sort() };
}
