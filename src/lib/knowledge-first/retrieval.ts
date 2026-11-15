import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { createEmbeddings } from "@/lib/rag/openai";
import { formatProductContext, selectRelevantProducts, type ApprovedProduct } from "@/lib/rag/product-context";
import { getOperationsWorkspace } from "@/lib/operations/repository";
import type { AssistantKind, Evidence } from "./types";
import { safePublicEntity } from "./policy";

export async function retrieveKnowledge(viewer: Viewer, question: string, assistant: AssistantKind): Promise<Evidence[]> {
  const db = await createClient();
  // A failed embedding request still permits authorized full-text retrieval.
  const embedding = await createEmbeddings([question]).then(([vector]) => `[${vector.join(",")}]`).catch(() => null);
  const { data: chunks, error } = await db.rpc("match_ai_knowledge", { query_embedding: embedding, target_org: viewer.organizationId, target_assistant: assistant, search_text: question });
  if (error) throw new Error("Knowledge retrieval unavailable");
  const evidence: Evidence[] = (chunks as { document_id: string; title: string; content: string; collection: string; authority: Evidence["authority"]; updated_at: string; expires_at: string | null; location_id: string | null }[] ?? []).map((row, index) => ({ id: `D${index + 1}`, documentId: row.document_id, title: row.title, content: row.content.slice(0, 7000), kind: "internal", category: row.collection, authority: row.authority, priority: row.authority === "policy" ? 2 : 1, updatedAt: row.updated_at, expiresAt: row.expires_at, locationId: row.location_id }));
  if (assistant === "sales") {
    const { data, error } = await db.from("products").select("id,name,model,description,base_price_cents,range_text,seats_text,powertrain_text,dimensions,running_distance,turning_radius,max_load_capacity,highlights,specifications,sales_guide,product_type,updated_at,manufacturer").eq("organization_id", viewer.organizationId).eq("status", "published").eq("review_status", "approved").order("sort_order").limit(250);
    if (error) throw new Error("Approved catalog unavailable");
    const products = selectRelevantProducts(question, (data ?? []) as (ApprovedProduct & { updated_at: string; manufacturer?: string })[], 10);
    for (const product of products) {
      const row = data?.find((row) => row.id === product.id);
      evidence.push({ id: `P${evidence.length + 1}`, title: `Approved catalog — ${product.name} ${product.model || ""}`, content: `${formatProductContext(product)}\nCatalog listing does not establish current stock availability.`, kind: "internal", category: product.product_type === "competitor_product" ? "comparison" : "product_specifications", authority: "approved", priority: product.product_type === "competitor_product" ? 4 : 3, updatedAt: row?.updated_at || "", publicEntity: safePublicEntity([row?.manufacturer, product.model || product.name].filter(Boolean).join(" ")) });
    }
  }
  // Reuse the existing authorized Operations repository, including its draft filter.
  const operations = await getOperationsWorkspace();
  if (operations.error) throw new Error("Operations knowledge unavailable");
  for (const procedure of operations.procedures.filter((record) => record.status === "Published" && (viewer.role !== "salesperson" || !["Management", "Employee & Administrative"].includes(record.category)) && (assistant === "operations" || record.category === "Sales Procedures"))) {
    evidence.push({ id: `O${evidence.length + 1}`, title: procedure.title, content: JSON.stringify({ summary: procedure.summary, steps: procedure.steps, content: procedure.content }).slice(0, 9000), kind: "internal", category: "procedure", authority: "policy", priority: 2, updatedAt: procedure.updatedAt });
  }
  if (assistant === "operations") {
    const records = [
      ...operations.checklists.map((row) => ({ title: row.title, content: row, updated: row.createdAt })),
      ...operations.alerts.map((row) => ({ title: row.title, content: row, updated: row.createdAt })),
      ...operations.schedules.map((row) => ({ title: row.procedureTitle, content: row, updated: row.lastGeneratedAt || "" })),
      ...operations.handoffs.map((row) => ({ title: `${row.location} handoff`, content: row, updated: row.updatedAt })),
      ...operations.incidents.map((row) => ({ title: row.title, content: row, updated: row.updatedAt })),
    ];
    // Rank candidates to bound context; semantic coverage still decides adequacy.
    const terms = question.toLowerCase().match(/[a-z]{3,}/g) ?? [];
    const ranked = records.map((row) => ({ ...row, score: terms.filter((word) => JSON.stringify(row.content).toLowerCase().includes(word)).length })).sort((a, b) => b.score - a.score).slice(0, 8);
    for (const row of ranked) evidence.push({ id: `R${evidence.length + 1}`, title: row.title, content: JSON.stringify(row.content).slice(0, 5000), kind: "internal", category: "operations", authority: "approved", priority: 4, updatedAt: row.updated });
  }
  const { data: organization } = await db.from("organizations").select("industry_template_id").eq("id", viewer.organizationId).maybeSingle();
  if (organization?.industry_template_id && assistant === "sales") {
    const { data: shared } = await db.from("industry_template_products").select("id,name,model,manufacturer,description,specifications,updated_at").eq("industry_template_id", organization.industry_template_id).limit(40);
    const terms = question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
    for (const row of (shared ?? []).filter((row) => terms.some((word) => `${row.name} ${row.model} ${row.manufacturer}`.toLowerCase().includes(word))).slice(0, 4)) evidence.push({ id: `T${evidence.length + 1}`, title: `Industry template — ${row.name}`, content: JSON.stringify(row), kind: "internal", category: "product_specifications", authority: "template", priority: 5, updatedAt: row.updated_at, publicEntity: safePublicEntity(`${row.manufacturer || ""} ${row.model || row.name}`.trim()) });
  }
  if (assistant === "operations") {
    const { data: shared } = await db.from("platform_procedure_templates").select("id,title,summary,steps,content,updated_at").eq("is_published", true).eq("is_standard", true).is("archived_at", null).limit(40);
    const words = question.toLowerCase().match(/[a-z]{4,}/g) ?? [];
    for (const row of (shared ?? []).filter((row) => words.some((word) => `${row.title} ${row.summary}`.toLowerCase().includes(word))).slice(0, 3)) evidence.push({ id: `S${evidence.length + 1}`, title: `Shared standard — ${row.title}`, content: JSON.stringify(row).slice(0, 7000), kind: "internal", category: "procedure", authority: "template", priority: 5, updatedAt: row.updated_at });
  }
  return evidence.sort((a, b) => a.priority - b.priority).slice(0, 32);
}
