import "server-only";
import * as XLSX from "xlsx";
import { extractDocumentPages } from "@/lib/rag/chunking";

export type ImportedTextTemplate = {
  clientId: string;
  title: string;
  content: string;
  category: string;
  status: "draft" | "published" | "archived";
  tags: string[];
  duplicateId?: string;
  duplicateReason?: string;
};

const cleanStatus = (value: unknown): ImportedTextTemplate["status"] => {
  const normalized = String(value || "draft").trim().toLowerCase();
  return normalized === "published" || normalized === "archived" ? normalized : "draft";
};

const cleanTags = (value: unknown) => String(value || "").split(/[,;|]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 20);

export async function parseTemplateSpreadsheet(file: File): Promise<ImportedTextTemplate[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const rows = workbook.SheetNames.flatMap((name) => XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: "" }));
  return rows.slice(0, 500).map((row, index) => ({
    clientId: `sheet-${index + 1}`,
    title: String(row.Title || row.title || "").trim().slice(0, 160),
    content: String(row.Content || row.content || "").trim().slice(0, 12000),
    category: String(row.Category || row.category || "").trim().slice(0, 120),
    status: cleanStatus(row.Status || row.status),
    tags: cleanTags(row.Tags || row.tags),
  })).filter((item) => item.title || item.content);
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

export function flagTemplateDuplicates(templates: ImportedTextTemplate[], existing: Array<{ id: string; title: string; body: string }>) {
  return templates.map((template) => {
    const exact = existing.find((item) => item.title.trim().toLowerCase() === template.title.trim().toLowerCase());
    const similar = exact || existing.find((item) => similarity(item.title, template.title) >= .72 || similarity(item.body, template.content) >= .82);
    return similar ? { ...template, duplicateId: similar.id, duplicateReason: exact ? "Exact title match" : "Similar existing template" } : template;
  });
}
