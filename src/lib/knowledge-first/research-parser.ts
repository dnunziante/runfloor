import type { Evidence, KnowledgeCategory } from "./types.ts";
import { validPublicUrl } from "./policy.ts";
export type ProviderResponse = { output?: { type: string; status?: string; content?: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string; start_index?: number; end_index?: number }[] }[] }[]; usage?: unknown };
export function researchSources(data: ProviderResponse, category: KnowledgeCategory, domains: string[], now: Date): Evidence[] {
  if (!data.output?.some((item) => item.type === "web_search_call" && item.status === "completed")) return [];
  const sources = new Map<string, Evidence>();
  for (const output of data.output) for (const content of output.content ?? []) {
    if (content.type !== "output_text" || !content.text) continue;
    for (const annotation of content.annotations ?? []) {
      const url = annotation.type === "url_citation" && annotation.url ? validPublicUrl(annotation.url) : null;
      if (!url || (domains.length && !domains.some((domain) => new URL(url).hostname === domain || new URL(url).hostname.endsWith(`.${domain}`)))) continue;
      if (typeof annotation.start_index !== "number" || typeof annotation.end_index !== "number") continue;
      const before = content.text.slice(0, annotation.start_index);
      const sentence = before.slice(Math.max(before.lastIndexOf("\n"), before.search(/[.!?]\s+[^.!?]*$/)) + 1).trim();
      if (!sentence) continue;
      const existing = sources.get(url);
      if (existing) { existing.content += `\n${sentence}`; continue; }
      sources.set(url, { id: `E${sources.size + 1}`, title: (annotation.title || new URL(url).hostname).slice(0, 200), url, content: sentence.slice(0, 16000), kind: "external", category, authority: "public", priority: 6, updatedAt: now.toISOString() });
    }
  }
  return [...sources.values()].slice(0, 6);
}
