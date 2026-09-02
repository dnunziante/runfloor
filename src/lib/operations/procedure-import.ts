import "server-only";

import { extractDocumentPages } from "@/lib/rag/chunking";
import { createImportedProcedure } from "@/lib/rag/openai";

const allowed = new Set([
  "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain",
  "image/png", "image/jpeg", "image/webp",
]);

export type ProcedureImportDraft = Awaited<ReturnType<typeof createImportedProcedure>>;

export async function extractProcedureImport(file: File, instruction = ""): Promise<ProcedureImportDraft> {
  if (!file.size) throw new Error("Choose a non-empty document.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Documents must be 10 MB or smaller.");
  const type = file.type || (file.name.toLowerCase().endsWith(".txt") ? "text/plain" : "");
  if (!allowed.has(type)) throw new Error("Upload a PDF, DOCX, TXT, PNG, JPG, JPEG, or WEBP file.");
  const image = type.startsWith("image/");
  const pages = image ? [] : await extractDocumentPages(file);
  const sourceText = pages.map((page) => page.text).join("\n\n").trim().slice(0, 100_000);
  if (!image && sourceText.length < 20) throw new Error("No readable text was found. For a scanned document, upload it as an image or use a clearer scan.");
  const imageData = image ? `data:${type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` : undefined;
  return createImportedProcedure({ sourceName: file.name, sourceText, imageData, instruction });
}
