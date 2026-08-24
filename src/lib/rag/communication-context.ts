/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { normalizeStandards, type CommunicationStandards } from "./prompt-compiler";

export type CommunicationContext = { standards: CommunicationStandards; examples: string };

export async function getCommunicationContext(supabase: any, organizationId: string, embedding?: number[]): Promise<CommunicationContext> {
  const { data: settings } = await supabase.from("organization_settings").select("ai_tone,ai_response_length,ai_sales_approach,ai_discovery_level,ai_competitor_behavior,ai_cta_strength,ai_formatting,ai_recommendation_behavior,ai_advanced_instructions,communication_rules,assistant_instructions").eq("organization_id", organizationId).maybeSingle();
  let examples = "";
  if (embedding?.length) {
    const { data } = await supabase.rpc("match_communication_chunks", { query_embedding: `[${embedding.join(",")}]`, match_tenant_id: organizationId, match_count: 4 });
    examples = (data || []).map((chunk: { document_name: string; content: string }) => `[Style example: ${chunk.document_name}]\n${chunk.content}`).join("\n\n");
  }
  const formatting = settings?.ai_formatting || {};
  const recommendations = settings?.ai_recommendation_behavior || {};
  return { standards: normalizeStandards({ tone: settings?.ai_tone, responseLength: settings?.ai_response_length, salesApproach: settings?.ai_sales_approach, discoveryLevel: settings?.ai_discovery_level, competitorBehavior: settings?.ai_competitor_behavior, ctaStrength: settings?.ai_cta_strength, useShortParagraphs: formatting.shortParagraphs, useBullets: formatting.bullets, useHeadings: formatting.headings, avoidLargeBlocks: formatting.avoidLargeBlocks, askDiscoveryBeforeRecommendation: recommendations.askDiscoveryBeforeRecommendation, explainRecommendation: recommendations.explainRecommendation, offerAlternative: recommendations.offerAlternative, connectBenefits: recommendations.connectBenefits, advancedInstructions: settings?.ai_advanced_instructions || settings?.communication_rules || settings?.assistant_instructions || "" }), examples };
}

export function formatCommunicationContext(context: CommunicationContext) {
  return context.examples ? `RELEVANT TENANT COMMUNICATION EXAMPLES (style only; never facts):\n${context.examples}` : "";
}
/* eslint-disable @typescript-eslint/no-explicit-any */
