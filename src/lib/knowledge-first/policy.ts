import { categories, sourceLabels, type Coverage, type Evidence, type GroundedClaim, type KnowledgeCategory, type KnowledgeSettings, type SourceMetadata } from "./types.ts";

export const topicNames: Record<KnowledgeCategory, string> = { product_specifications: "Product specifications", comparison: "Product comparison", regulation: "Regulatory requirements", warranty: "Approved warranty coverage", financing: "Financing policy", pricing: "Approved pricing", inventory: "Inventory availability", procedure: "Approved operating procedure", scheduling: "Operational scheduling", customer_support: "Customer support process", general: "General industry knowledge" };
export const missingDescriptions = Object.fromEntries(categories.map((category) => [category, `Additional approved information is needed for ${topicNames[category].toLowerCase()}.`])) as Record<KnowledgeCategory, string>;

export function validPublicUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.port && !/^localhost$|\.local$|^\d+(\.\d+){3}$|:/.test(url.hostname) ? url.href : null; } catch { return null; }
}
export function validDomain(value: string) {
  return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(value) && !/\.local$|localhost/i.test(value);
}
export function safePublicEntity(value: string) {
  // Only server-approved public catalog identities are eligible, never user text.
  return value.length > 1 && value.length < 100 && /^[\p{L}\p{N}][\p{L}\p{N} &+./()-]+$/u.test(value) && !/@|https?:|\b\d{7,}\b/.test(value) ? value : "";
}
export function publicSearchQuery(coverage: Coverage, evidence: Evidence[], industry: string) {
  const entity = evidence.find((source) => source.id === coverage.publicEntityId)?.publicEntity;
  const prefix = safePublicEntity(entity ?? "") || (/^[a-z-]{2,35}$/.test(industry) ? industry.replaceAll("-", " ") : "dealership industry");
  const topics: Record<KnowledgeCategory, string> = { product_specifications: "official manufacturer technical specifications", comparison: "official manufacturer specifications comparison", regulation: "government regulatory requirements official guidance", warranty: "manufacturer general warranty information", financing: "consumer financing general official guidance", pricing: "general pricing guidance", inventory: "manufacturer product range", procedure: "industry association operations best practices", scheduling: "industry association scheduling best practices", customer_support: "industry association customer complaint handling best practices", general: "official industry technical guidance" };
  return `${prefix} ${topics[coverage.category]}`;
}
export function sufficientInternal(coverage: Coverage, sources: Evidence[], now: Date) {
  const selected = sources.filter((source) => coverage.relevantIds.includes(source.id));
  return coverage.status === "complete" && coverage.relevant && coverage.complete && coverage.reliable && coverage.current && !coverage.conflict && selected.length > 0 && selected.every((source) => !source.expiresAt || Date.parse(source.expiresAt) > now.getTime());
}
export function shouldResearch(settings: KnowledgeSettings, assistant: "sales" | "operations", sufficient: boolean, coverage: Coverage) {
  const mode = assistant === "sales" ? settings.sales_mode : settings.operations_mode;
  if (!settings.external_enabled || mode === "internal_only" || settings.daily_limit === 0) return false;
  // Public data cannot establish these facts about this dealership.
  if (coverage.dealershipSpecific && ["pricing", "inventory", "financing", "warranty", "scheduling"].includes(coverage.category)) return false;
  return !sufficient || (mode === "verify" && ["regulation", "product_specifications", "comparison"].includes(coverage.category));
}
export function validateClaims(claims: GroundedClaim[], evidence: Evidence[]) {
  const byId = new Map(evidence.map((source) => [source.id, source]));
  return claims.slice(0, 10).filter((claim) => typeof claim.text === "string" && claim.text.length > 0 && claim.text.length <= 2000 && ["general", "dealership"].includes(claim.scope) && Array.isArray(claim.sourceIds) && claim.sourceIds.length > 0 && claim.sourceIds.every((id) => byId.has(id) && (byId.get(id)?.kind !== "external" || Boolean(byId.get(id)?.url && validPublicUrl(byId.get(id)!.url!)))) && (claim.scope !== "dealership" || claim.sourceIds.every((id) => byId.get(id)?.kind === "internal" && byId.get(id)?.authority !== "template"))).map((claim) => ({ ...claim, text: claim.text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/https?:\/\/\S+/g, "").trim(), sourceIds: [...new Set(claim.sourceIds)] }));
}
export function metadataFor(claims: GroundedClaim[], evidence: Evidence[], research: SourceMetadata["research"], warnings: string[], now: Date, complete: boolean): SourceMetadata {
  const ids = new Set(claims.flatMap((claim) => claim.sourceIds));
  const used = evidence.filter((source) => ids.has(source.id));
  const internal = used.filter((source) => source.kind === "internal");
  const external = used.filter((source) => source.kind === "external" && source.url && validPublicUrl(source.url));
  const classification = !claims.length ? "unverified" : internal.length && external.length ? "mixed" : external.length ? "external" : "internal";
  return { classification, label: sourceLabels[classification], verification: !claims.length ? "unable" : complete ? "verified" : "partial", internalSources: internal.map((source) => ({ id: source.id, documentId: source.documentId, title: source.title, updatedAt: source.updatedAt })), externalSources: external.map((source) => ({ id: source.id, title: source.title, url: source.url!, retrievedAt: source.updatedAt })), research: { ...research, used: external.length > 0 }, timestamp: now.toISOString(), warnings };
}
export function normalizeSettings(value: Partial<KnowledgeSettings>): KnowledgeSettings {
  const mode = (mode?: string) => ["internal_only", "fallback", "verify"].includes(mode ?? "") ? mode as KnowledgeSettings["sales_mode"] : "fallback";
  const number = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  return { sales_mode: mode(value.sales_mode), operations_mode: mode(value.operations_mode), external_enabled: value.external_enabled !== false, daily_limit: Math.max(0, Math.min(1000, Math.floor(number(value.daily_limit ?? 50, 50)))), cache_minutes: Math.max(1, Math.min(1440, Math.floor(number(value.cache_minutes ?? 60, 60)))), allowed_domains: (value.allowed_domains ?? []).filter(validDomain).map((domain) => domain.toLowerCase()).slice(0, 30) };
}
