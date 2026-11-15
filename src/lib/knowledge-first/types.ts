export type AssistantKind = "sales" | "operations";
export type KnowledgeMode = "internal_only" | "fallback" | "verify";
export type SourceClassification = "internal" | "external" | "mixed" | "unverified";
export type KnowledgeCategory = "product_specifications" | "comparison" | "regulation" | "warranty" | "financing" | "pricing" | "inventory" | "procedure" | "scheduling" | "customer_support" | "general";
export type Evidence = {
  id: string; title: string; content: string; kind: "internal" | "external";
  category: string; authority: "policy" | "approved" | "uploaded" | "template" | "public";
  priority: number; updatedAt: string; expiresAt?: string | null;
  documentId?: string; url?: string; locationId?: string | null;
  publicEntity?: string;
};
export type KnowledgeSettings = {
  sales_mode: KnowledgeMode; operations_mode: KnowledgeMode; external_enabled: boolean;
  daily_limit: number; cache_minutes: number; allowed_domains: string[];
};
export const defaultKnowledgeSettings: KnowledgeSettings = { sales_mode: "fallback", operations_mode: "fallback", external_enabled: true, daily_limit: 50, cache_minutes: 60, allowed_domains: [] };
export const sourceLabels: Record<SourceClassification, string> = { internal: "RunFloor Knowledge", external: "External Research", mixed: "RunFloor Knowledge + External Research", unverified: "Unable to Verify" };
export const categories: KnowledgeCategory[] = ["product_specifications", "comparison", "regulation", "warranty", "financing", "pricing", "inventory", "procedure", "scheduling", "customer_support", "general"];
export type Coverage = {
  status: "complete" | "partial" | "missing"; relevantIds: string[];
  category: KnowledgeCategory; missing: KnowledgeCategory[];
  relevant: boolean; complete: boolean; reliable: boolean; current: boolean; conflict: boolean;
  dealershipSpecific: boolean; publicEntityId: string | null;
};
export type GroundedClaim = { text: string; sourceIds: string[]; scope: "dealership" | "general" };
export type SourceMetadata = {
  classification: SourceClassification; label: string; verification: "verified" | "partial" | "unable";
  internalSources: { id: string; documentId?: string; title: string; updatedAt: string }[];
  externalSources: { id: string; url: string; title: string; retrievedAt: string }[];
  research: { attempted: boolean; used: boolean; succeeded: boolean; cached: boolean; reason?: string };
  timestamp: string; warnings: string[];
};
export type KnowledgeAnswer = { answer: string; metadata: SourceMetadata; claims: GroundedClaim[]; sources: { documentName: string; url?: string }[] };
export type ResearchResult = { evidence: Evidence[]; performed: boolean; cached: boolean; reason?: string };
export type GapEvent = { suggestedAnswer?: string; assistant: AssistantKind; category: KnowledgeCategory; topic: string; missing: string; classification: SourceClassification; internalComplete: boolean; researchAttempted: boolean; researchUsed: boolean; researchSucceeded: boolean; answered: boolean; sourceReferences: Omit<Evidence, "content" | "publicEntity">[] };
export type PipelineServices = {
  retrieve(question: string, assistant: AssistantKind): Promise<Evidence[]>;
  assess(question: string, evidence: Evidence[], assistant: AssistantKind): Promise<Coverage>;
  research(query: string, category: KnowledgeCategory): Promise<ResearchResult>;
  generate(question: string, evidence: Evidence[], coverage: Coverage, assistant: AssistantKind, history: string): Promise<GroundedClaim[]>;
  verify(question: string, claims: GroundedClaim[], evidence: Evidence[]): Promise<number[]>;
  record(event: GapEvent): Promise<void>;
  now(): Date;
};
