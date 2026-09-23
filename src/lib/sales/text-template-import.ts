import "server-only";
import * as XLSX from "xlsx";
import { extractDocumentPages } from "@/lib/rag/chunking";

export type ImportedTextTemplate = {
  clientId: string;
  title: string;
  objection: string;
  content: string;
  category: string;
  status: "draft" | "published" | "archived";
  tags: string[];
  duplicateId?: string;
  duplicateReason?: string;
  validationIssues: string[];
};

const cleanStatus = (value: unknown): ImportedTextTemplate["status"] => {
  const normalized = String(value || "draft").trim().toLowerCase();
  return normalized === "published" || normalized === "archived" ? normalized : "draft";
};

const cleanTags = (value: unknown) => String(value || "").split(/[,;|]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 20);

export async function parseTemplateSpreadsheet(file: File): Promise<ImportedTextTemplate[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const rows = workbook.SheetNames.flatMap((name) => XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: "" }));
  return rows.slice(0, 500).map((row, index) => {
    const title = String(row.Title || row.title || row.Script_Name || row.script_name || row.Response_Name || row.response_name || "").trim().slice(0, 160);
    const objection = String(row.Objection || row.objection || row.Customer_Objection || row.customer_objection || "").trim().slice(0, 4000);
    const content = String(row.Response || row.response || row.Content || row.content || row.Script_Content || row.script_content || "").trim().slice(0, 12000);
    const rawStatus = String(row.Status || row.status || "draft").trim().toLowerCase();
    const category = String(row.Category || row.category || "").trim().slice(0, 120);
    const validationIssues = [];
    if (title.length < 2) validationIssues.push("Script name is required");
    if (content.length < 2) validationIssues.push("Content is required");
    if (!category) validationIssues.push("Category is required");
    if (!["draft", "published", "archived"].includes(rawStatus)) validationIssues.push("Status must be Draft, Published, or Archived");
    return { clientId: `sheet-${index + 1}`, title, objection, content, category, status: cleanStatus(rawStatus), tags: cleanTags(row.Tags || row.tags), validationIssues };
  }).filter((item) => item.title || item.objection || item.content || item.category);
}

export async function readTemplateDocument(file: File) {
  const pages = await extractDocumentPages(file);
  const text = pages.map((page) => page.text).join("\n\n").trim().slice(0, 60_000);
  if (!text) throw new Error("No readable text was found in this document.");
  return text;
}

const words = (value: string) => new Set(value.toLowerCase().replace(/\{\{[^}]+\}\}/g, " ").replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((word) => word.length > 2));
const similarity = (left: string, right: string) => {
  const a = words(left), b = words(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0; a.forEach((word) => { if (b.has(word)) overlap++; });
  return overlap / Math.max(a.size, b.size);
};

export function flagTemplateDuplicates(templates: ImportedTextTemplate[], existing: Array<{ id: string; title: string; objection?: string | null; body: string }>) {
  return templates.map((template) => {
    const exact = existing.find((item) => item.title.trim().toLowerCase() === template.title.trim().toLowerCase());
    const similar = exact || existing.find((item) => similarity(item.title, template.title) >= .72 || (template.objection && similarity(item.objection || "", template.objection) >= .82) || similarity(item.body, template.content) >= .82);
    return similar ? { ...template, duplicateId: similar.id, duplicateReason: exact ? "Exact title match" : "Similar existing template" } : template;
  });
}
