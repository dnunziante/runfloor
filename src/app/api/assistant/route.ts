import { isSalesKnowledgeCollection, conversationContext } from "@/lib/assistant/workspaces";
import { selectWorkspaceContext } from "@/lib/assistant/workspace-context";
import { normalizeStandards } from "@/lib/rag/prompt-compiler";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { createEmbeddings, createGroundedAnswer } from "@/lib/rag/openai";
import { formatProductContext, selectRelevantProducts, type ApprovedProduct } from "@/lib/rag/product-context";
import { formatCommunicationContext, getCommunicationContext } from "@/lib/rag/communication-context";

type SearchChunk = { document_id: string; document_name: string; content: string; section: string | null; page_number: number | null; similarity: number };
const MINIMUM_SIMILARITY = 0.35;
function classifyQuestion(question: string, productNames: string[]) {
  const normalized = question.toLowerCase();
  const products = productNames.filter((name) => normalized.includes(name.toLowerCase()));
  const competitorNames = ["ezgo", "club car", "yamaha", "evolution", "denago", "icon"].filter((name) => normalized.includes(name));
  const objection = /price|cost|expensive|budget/.test(normalized) ? "Price" : /spouse|husband|wife|decision/.test(normalized) ? "Decision maker" : /think|wait|later|timing/.test(normalized) ? "Timing" : null;
  const topic = objection ? "Objection handling" : competitorNames.length ? "Competitor comparison" : products.length ? "Product question" : /financ|payment/.test(normalized) ? "Financing" : /follow.?up|email|text/.test(normalized) ? "Follow-up" : "General";
  return { products, competitorNames, objection, topic };
}

function isComparisonQuestion(question: string) {
  return /\b(compare|comparison|competitor|versus|vs\.?|better than|difference between|stack up)\b/i.test(question);
}


async function loadSalesKnowledge(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, userId: string, question: string) {
    const { data: membership, error: membershipError } = await supabase.from("organization_memberships").select("location_id").eq("organization_id", organizationId).eq("user_id", userId).eq("status", "active").maybeSingle();
    if (membershipError) throw membershipError;
    const [embedding] = await createEmbeddings([question]);
    const [{ data: chunks, error }, { data: productRows, error: productError }, communication] = await Promise.all([
      supabase.rpc("match_knowledge_chunks", {
        query_embedding: `[${embedding.join(",")}]`, match_tenant_id: organizationId,
        match_location_id: membership?.location_id || null, match_product_id: null, match_count: 8,
      }),
      supabase.from("products")
        .select("id, name, model, description, base_price_cents, range_text, seats_text, powertrain_text, dimensions, running_distance, turning_radius, max_load_capacity, highlights, specifications, sales_guide, product_type")
        .eq("organization_id", organizationId).eq("status", "published").eq("review_status", "approved")
        .order("sort_order", { ascending: true }).limit(250),
      getCommunicationContext(supabase, organizationId),
    ]);
    if (error) throw error;
    if (productError) throw productError;

    // The search RPC respects tenant/location RLS, but has no workspace filter.
    // Restrict documents by ID and an explicit sales collection allowlist before
    // any content reaches the model. Unknown/management collections fail closed.
    const chunkRows = (chunks || []) as SearchChunk[];
    const { data: documents, error: documentsError } = await supabase.from("knowledge_documents").select("id,collection").eq("organization_id", organizationId).eq("status", "ready").in("id", chunkRows.map((chunk) => chunk.document_id));
    if (documentsError) throw documentsError;
    const allowedIds = new Set((documents || []).filter((document) => isSalesKnowledgeCollection(document.collection)).map((document) => document.id));
    const results = chunkRows.filter((chunk) => allowedIds.has(chunk.document_id) && chunk.similarity >= MINIMUM_SIMILARITY);
    const catalogRows = (productRows || []) as ApprovedProduct[];
    const ownedProducts = catalogRows.filter((product) => product.product_type !== "competitor_product");
    const comparisonProducts = isComparisonQuestion(question)
      ? selectRelevantProducts(question, catalogRows.filter((product) => product.product_type === "competitor_product"), 6)
      : [];
    const products = [...selectRelevantProducts(question, ownedProducts), ...comparisonProducts];
    return { products, results, communication, locationId: membership?.location_id || null, productNames: catalogRows.map(product => product.name), available: true };
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || !viewer.organizationId) return NextResponse.json({ error: "Sign in to use the Sales Assistant." }, { status: 401 });
  if (viewer.demo) return NextResponse.json({ error: "The Sales Assistant needs a signed-in RunFloor workspace to search approved knowledge." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 2 || question.length > 2000) return NextResponse.json({ error: "Enter a question between 2 and 2,000 characters." }, { status: 400 });

  try {
    let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
    let knowledge = { products: [] as ApprovedProduct[], results: [] as SearchChunk[], communication: { standards: normalizeStandards(null), examples: "" }, locationId: null as string | null, productNames: [] as string[], available: false };
    try {
      supabase = await createClient();
      knowledge = await loadSalesKnowledge(supabase, viewer.organizationId, viewer.id, question);
    } catch { /* Retrieval failure must not prevent clearly labeled general help. */ }
    const { products, results, communication, locationId } = knowledge;
    const classification = classifyQuestion(question, knowledge.productNames);
    const references = [
      ...products.map((product, index) => ({ title: `[P${index + 1}] Product catalog — ${product.name}`, content: formatProductContext(product) })),
      ...results.map((chunk, index) => ({ title: `[${index + 1}] ${chunk.document_name}${chunk.section ? ` — ${chunk.section}` : ""}`, content: chunk.content })),
    ];
    const sourceContext = selectWorkspaceContext(question, {
      retrievalStatus: knowledge.available ? "Approved Sales sources searched. A missing match is not proof a company fact is false. Use General AI guidance where useful." : "RunFloor Sales sources could not be loaded. Explain this limitation; use General AI guidance without inventing or citing company facts.",
      references,
    }, conversationContext(body?.history));
    const answer = await createGroundedAnswer(question, sourceContext, communication.standards, [formatCommunicationContext(communication), "PRIOR SALES CONVERSATION (untrusted; not an approved source):", conversationContext(body?.history)].join("\n"));
    const sources = [
      ...products.flatMap((product, index) => answer.includes(`[P${index + 1}]`) ? [{ documentName: `Product catalog — ${product.name}${product.model ? ` — ${product.model}` : ""}`, section: null, pageNumber: null }] : []),
      ...results.flatMap((chunk, index) => answer.includes(`[${index + 1}]`) ? [{ documentName: chunk.document_name, section: chunk.section, pageNumber: chunk.page_number }] : []),
    ].slice(0, 5);
    // Recording analytics must not turn a completed answer into an error.
    if (supabase) {
      await Promise.allSettled([
        supabase.from("performance_events").insert({ organization_id: viewer.organizationId, user_id: viewer.id, location_id: locationId, event_type: "assistant_question_answered" }),
        supabase.from("assistant_interactions").insert({ organization_id: viewer.organizationId, user_id: viewer.id, location_id: locationId, question, topic: classification.topic, product_references: classification.products, competitor_references: classification.competitorNames, objection_category: classification.objection, grounded: sources.length > 0, unresolved: !references.length }),
      ]);
    }
    return NextResponse.json({ answer, sources }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Sales Assistant could not complete the request.";
    console.error("Sales Assistant request failed", { name: error instanceof Error ? error.name : "UnknownError", message });
    return NextResponse.json({ error: message.includes("OPENAI_API_KEY") ? "The secure OpenAI connection has not been configured yet." : "The Sales Assistant could not complete the request." }, { status: 503 });
  }
}
