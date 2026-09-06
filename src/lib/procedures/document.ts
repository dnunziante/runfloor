import type { JSONContent } from "@tiptap/core";

export type ProcedureTemplate = {
  id: string; title: string; category: string; owner: string; summary: string;
  steps: unknown; content: Record<string, unknown>; version: number;
  is_published: boolean; created_at: string; updated_at: string;
};
export const templateColumns = "id,title,category,owner,summary,steps,content,version,is_published,created_at,updated_at";
export function isPlatformTemplateEditor(viewer: { role: string; demo?: boolean } | null) {
  return viewer?.role === "platform_owner" && !viewer.demo;
}
export function legacyText(steps: unknown): string {
  if (typeof steps === "string") return steps;
  if (Array.isArray(steps)) return steps.map(step => typeof step === "string" ? step : JSON.stringify(step, null, 2)).join("\n\n");
  return steps == null ? "" : JSON.stringify(steps, null, 2);
}
// This adapter never writes to storage. Keep every line, blank line, bullet and
// numbering character. Only identifiable headings receive semantic styling.
export function legacyDocument(steps: unknown): JSONContent {
  const text = legacyText(steps);
  return { type: "doc", content: text.split(/\r\n|\r|\n/).map(line => {
    const heading = /^(?:\d+[.)]\s+\S|#{1,3}\s+\S)/.test(line) || /^(?:[A-Z][A-Z &:/-]{3,}|(?:[A-Z][a-z]+\s+){0,3}(?:Standard|Standards|Purpose|Responsibilities|Procedure|Expectations|Principle|Notes|Warning|Tips|Example|Examples))$/.test(line);
    return { type: heading ? "heading" : "paragraph", ...(heading ? { attrs: { level: 2 } } : {}), ...(line ? { content: [{ type: "text", text: line }] } : {}) };
  }) };
}
export function procedureDocument(template: Pick<ProcedureTemplate, "steps" | "content">): JSONContent {
  const stored = template.content?.runfloorDocument as { format?: string; document?: JSONContent } | undefined;
  if (stored?.format === "tiptap-v1" && stored.document?.type === "doc") return stored.document;
  return legacyDocument(template.steps);
}
export function documentText(node: JSONContent): string {
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  const separator = ["doc", "bulletList", "orderedList", "taskList", "blockquote", "table", "tableRow", "tableCell", "tableHeader", "listItem", "taskItem"].includes(node.type || "") ? "\n" : "";
  return (node.content || []).map(documentText).join(separator);
}
export function templateReturnPath(category = "", query = "") {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (query) params.set("templateSearch", query);
  return `/admin/platform${params.size ? `?${params}` : ""}#procedure-library-heading`;
}
