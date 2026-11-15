import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCommunicationContext } from "@/lib/rag/communication-context";
import { answerKnowledgeFirst } from "./pipeline";
import { normalizeSettings } from "./policy";
import { assessKnowledge, generateKnowledgeClaims, verifyKnowledgeClaims } from "./models";
import { retrieveKnowledge } from "./retrieval";
import { researchPublic } from "./research";
import type { AssistantKind, KnowledgeAnswer } from "./types";

export async function runKnowledgeAssistant(viewer: Viewer, question: string, assistant: AssistantKind, history: string): Promise<KnowledgeAnswer> {
  const db = await createClient();
  const [{ data: saved, error }, { data: organization }, { data: membership }, communication] = await Promise.all([
    db.from("ai_knowledge_settings").select("*").eq("organization_id", viewer.organizationId).maybeSingle(),
    db.from("organizations").select("industry_templates(template_key)").eq("id", viewer.organizationId).maybeSingle(),
    db.from("organization_memberships").select("location_id").eq("organization_id", viewer.organizationId).eq("user_id", viewer.id).eq("status", "active").maybeSingle(),
    assistant === "sales" ? getCommunicationContext(db, viewer.organizationId) : Promise.resolve(null),
  ]);
  if (error) throw new Error("Knowledge settings unavailable");
  const template = organization?.industry_templates as unknown as { template_key?: string } | null;
  return answerKnowledgeFirst(question, assistant, normalizeSettings(saved ?? {}), template?.template_key || "dealership", history, {
    retrieve: (question, assistant) => retrieveKnowledge(viewer, question, assistant),
    assess: assessKnowledge, research: (query, category) => researchPublic(viewer, normalizeSettings(saved ?? {}), query, category),
    generate: (question, evidence, coverage, assistant, history) => generateKnowledgeClaims(question, evidence, coverage, assistant, history, communication?.standards),
    verify: verifyKnowledgeClaims, now: () => new Date(),
    record: async (event) => {
      const { error } = await createAdminClient().rpc("record_ai_knowledge", { target_org: viewer.organizationId, actor: viewer.id, target_location: membership?.location_id || null, event });
      if (error) throw new Error("Telemetry unavailable");
      if (assistant === "sales") {
        await db.from("assistant_interactions").insert({ organization_id: viewer.organizationId, user_id: viewer.id, location_id: membership?.location_id || null, question: event.topic, topic: event.topic, product_references: [], competitor_references: [], grounded: event.classification === "internal" || event.classification === "mixed", unresolved: !event.answered });
        if (event.answered) await db.from("performance_events").insert({ organization_id: viewer.organizationId, user_id: viewer.id, location_id: membership?.location_id || null, event_type: "assistant_question_answered" });
      }
    },
  });
}
