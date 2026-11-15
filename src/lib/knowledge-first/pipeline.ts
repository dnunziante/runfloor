import type { AssistantKind, Coverage, Evidence, GapEvent, KnowledgeAnswer, KnowledgeSettings, PipelineServices } from "./types.ts";
import { metadataFor, missingDescriptions, publicSearchQuery, shouldResearch, sufficientInternal, topicNames, validateClaims } from "./policy.ts";

export async function answerKnowledgeFirst(question: string, assistant: AssistantKind, settings: KnowledgeSettings, industry: string, history: string, services: PipelineServices): Promise<KnowledgeAnswer> {
  const now = services.now();
  let evidence: Evidence[] = [];
  let coverage: Coverage = { status: "missing", relevantIds: [], category: "general", missing: ["general"], relevant: false, complete: false, reliable: false, current: false, conflict: false, dealershipSpecific: true, publicEntityId: null };
  const warnings: string[] = [];
  const research = { attempted: false, used: false, succeeded: false, cached: false, reason: "" };
  let claims: KnowledgeAnswer["claims"] = [];
  let complete = false;
  try {
    evidence = (await services.retrieve(question, assistant)).sort((a, b) => a.priority - b.priority).slice(0, 32);
    coverage = await services.assess(question, evidence, assistant);
    complete = sufficientInternal(coverage, evidence, now);
    if (!complete) warnings.push(missingDescriptions[coverage.category]);
    if (coverage.conflict || (evidence.length > 0 && !coverage.current) || evidence.some((source) => source.expiresAt && Date.parse(source.expiresAt) <= now.getTime())) warnings.push("Some internal information may be outdated or conflicting. Verify current requirements before acting; public information does not replace approved dealership practices.");
    if (shouldResearch(settings, assistant, complete, coverage)) {
      research.attempted = true;
      try {
        const result = await services.research(publicSearchQuery(coverage, evidence, industry), coverage.category);
        research.cached = result.cached;
        research.succeeded = result.performed && result.evidence.length > 0;
        research.reason = result.reason ?? "";
        evidence = [...evidence, ...result.evidence];
        if (!result.evidence.length) warnings.push(result.reason || "External research is unavailable. Only reliable internal information can be used.");
      } catch { warnings.push("External research could not be completed. Only reliable internal information can be used."); research.reason = "Provider unavailable"; }
    }
    const proposed = evidence.length ? validateClaims(await services.generate(question, evidence, coverage, assistant, history), evidence) : [];
    const accepted = proposed.length ? await services.verify(question, proposed, evidence) : [];
    claims = proposed.filter((_, index) => accepted.includes(index));
    if (accepted.length !== proposed.length) warnings.push("Unsupported statements were omitted from this answer.");
  } catch { warnings.push("Approved information could not be fully verified. Please contact a manager or add the missing documentation."); }
  const metadata = metadataFor(claims, evidence, research, [...new Set(warnings)], now, complete && !coverage.conflict);
  const gap: GapEvent = { suggestedAnswer: evidence.filter((source) => source.kind === "external").map((source) => `${source.title}\n${source.content}\n${source.url}`).join("\n\n").slice(0, 12000), assistant, category: coverage.category, topic: topicNames[coverage.category], missing: missingDescriptions[coverage.category], classification: metadata.classification, internalComplete: complete, researchAttempted: research.attempted, researchUsed: metadata.research.used, researchSucceeded: research.succeeded, answered: claims.length > 0, sourceReferences: evidence.filter((source) => coverage.relevantIds.includes(source.id) || source.kind === "external").map((source) => ({ id: source.id, title: source.title, kind: source.kind, category: source.category, authority: source.authority, priority: source.priority, updatedAt: source.updatedAt, expiresAt: source.expiresAt, documentId: source.documentId, url: source.url, locationId: source.locationId })) };
  try { await services.record(gap); } catch { metadata.warnings.push("Usage tracking is temporarily unavailable."); }
  const answer = claims.length ? claims.map((claim) => `${claim.scope === "general" && claim.sourceIds.some((id) => evidence.find((source) => source.id === id)?.kind === "external") ? "**General public information:** " : ""}${claim.text} ${claim.sourceIds.map((id) => `[${id}]`).join(" ")}`).join("\n\n") : "I could not verify an answer from the available approved knowledge or reliable public sources. Please ask a manager or add the missing documentation.";
  return { answer, metadata, claims, sources: [...metadata.internalSources.map((source) => ({ documentName: source.title })), ...metadata.externalSources.map((source) => ({ documentName: source.title, url: source.url }))] };
}
