import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createEmbeddings, createSalesText, type SalesEmailInput } from "@/lib/rag/openai";
import { formatProductContext, selectRelevantProducts, type ApprovedProduct } from "@/lib/rag/product-context";
import { createClient } from "@/lib/supabase/server";
import { getCommunicationContext } from "@/lib/rag/communication-context";

type SearchChunk = { document_name: string; content: string; section: string | null; page_number: number | null; similarity: number };
const tones = new Set<SalesEmailInput["tone"]>(["Professional", "Friendly", "Direct", "Urgency", "Re-engagement"]);
const text = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.organizationId || viewer.demo) return NextResponse.json({ error: "Sign in to generate a sales text." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Enter the text-message details." }, { status: 400 });
  const input: SalesEmailInput = {
    customerName: text(body.customerName, 120), product: text(body.product, 160), leadStage: text(body.leadStage, 80),
    customerNeeds: text(body.customerNeeds, 1200), previousConversation: text(body.previousConversation, 1600), objection: text(body.objection, 1000),
    desiredNextAction: text(body.desiredNextAction, 500), tone: tones.has(body.tone) ? body.tone : "Professional",
  };
  if (!input.customerName) return NextResponse.json({ error: "Enter the customer's name." }, { status: 400 });
  if (!input.product && !input.previousConversation && !input.customerNeeds) return NextResponse.json({ error: "Add a product, customer need, or previous conversation." }, { status: 400 });

  try {
    const supabase = await createClient();
    const { data: membership } = await supabase.from("organization_memberships").select("location_id").eq("organization_id", viewer.organizationId).eq("user_id", viewer.id).eq("status", "active").maybeSingle();
    const retrievalText = [input.product, input.customerNeeds, input.previousConversation, input.objection].filter(Boolean).join("\n");
    const [embedding] = await createEmbeddings([retrievalText]);
    const [{ data: chunks, error: chunkError }, { data: productRows, error: productError }, communication] = await Promise.all([
      supabase.rpc("match_knowledge_chunks", { query_embedding: `[${embedding.join(",")}]`, match_tenant_id: viewer.organizationId, match_location_id: membership?.location_id || null, match_product_id: null, match_count: 6 }),
      supabase.from("products").select("id, name, model, description, base_price_cents, range_text, seats_text, powertrain_text, dimensions, running_distance, turning_radius, max_load_capacity, highlights, sales_guide, product_type").eq("organization_id", viewer.organizationId).eq("status", "published").eq("review_status", "approved").neq("product_type", "competitor_product").order("sort_order").limit(250),
      getCommunicationContext(supabase, viewer.organizationId, embedding),
    ]);
    if (chunkError) throw chunkError;
    if (productError) throw productError;
    const products = selectRelevantProducts(retrievalText, (productRows || []) as ApprovedProduct[], 8);
    let overrides = new Map<string, number | null>();
    if (membership?.location_id && products.length) {
      const { data: locationPrices, error: locationError } = await supabase.from("product_locations").select("product_id, price_override_cents, is_available").eq("location_id", membership.location_id).in("product_id", products.map((product) => product.id));
      if (locationError) throw locationError;
      overrides = new Map((locationPrices || []).filter((row) => row.is_available).map((row) => [row.product_id as string, row.price_override_cents as number | null]));
    }
    const productContext = products.map((product) => formatProductContext(product, overrides.get(product.id)));
    const documentContext = ((chunks || []) as SearchChunk[]).filter((chunk) => chunk.similarity >= 0.35).map((chunk) => `${chunk.document_name}${chunk.section ? ` — ${chunk.section}` : ""}${chunk.page_number ? `, page ${chunk.page_number}` : ""}\n${chunk.content}`);
    return NextResponse.json(await createSalesText(input, [...productContext, ...documentContext].join("\n\n"), viewer.fullName, communication.standards));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message.includes("OPENAI_API_KEY") ? "The secure OpenAI connection has not been configured yet." : "The text could not be generated. Please try again." }, { status: 503 });
  }
}
