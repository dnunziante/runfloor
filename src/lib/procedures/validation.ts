import { getSchema, type JSONContent } from "@tiptap/core";
import { procedureExtensions } from "./extensions.ts";
export function validateDocument(document: JSONContent) {
  if (!document || document.type !== "doc" || JSON.stringify(document).length > 2_000_000) throw new Error("The procedure document is invalid or exceeds 2 MB.");
  function check(node: JSONContent, depth = 0) {
    if (depth > 60) throw new Error("The document contains too many nested sections.");
    for (const mark of node.marks || []) {
      if (mark.type === "link" && !/^(https?:\/\/|mailto:|\/[^/]|#)/i.test(String(mark.attrs?.href || ""))) throw new Error("Use an https, http, or email link.");
    }
    for (const child of node.content || []) check(child, depth + 1);
  }
  check(document);
  const parsed = getSchema(procedureExtensions()).nodeFromJSON(document);
  parsed.check();
  // Reject unsupported attributes instead of silently discarding them.
  const canonical = parsed.toJSON();
  function supported(input: JSONContent, normalized: JSONContent) {
    for (const key of Object.keys(input.attrs || {})) if (!(key in (normalized.attrs || {}))) throw new Error("Unsupported document formatting. No changes were saved.");
    (input.content || []).forEach((child, index) => supported(child, normalized.content![index]));
  }
  supported(document, canonical);
}
