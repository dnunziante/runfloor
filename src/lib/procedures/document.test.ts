import assert from "node:assert/strict";
import test from "node:test";
import { documentText, legacyDocument, procedureDocument, isPlatformTemplateEditor, templateReturnPath } from "./document.ts";
import { validateDocument } from "./validation.ts";
import { getSchema } from "@tiptap/core";
import { procedureExtensions } from "./extensions.ts";

test("Legacy adapter preserves all text, blank lines, tabs, numbering, and spacing", () => {
  const steps = ["1. First heading\r\n  Indented paragraph\r\n\r\n•\tBullet\r\n2) Second heading\r\n\r\n", "Final paragraph\n\n"];
  const original = JSON.stringify(steps);
  const doc = legacyDocument(steps);
  assert.equal(documentText(doc), steps.join("\n\n").replaceAll("\r\n", "\n"));
  assert.equal(JSON.stringify(steps), original);
  validateDocument(doc);
  assert.equal(documentText(getSchema(procedureExtensions()).nodeFromJSON(doc).toJSON()), documentText(doc));
});
test("Missing body never substitutes the summary", () => {
  assert.equal(documentText(procedureDocument({ steps: [], content: {} })), "");
});
test("Rich format survives schema round trip", () => {
  const paragraph = { type: "paragraph", content: [{ type: "text", text: "Complete content", marks: [{ type: "bold" }, { type: "italic" }, { type: "link", attrs: { href: "https://example.com" } }] }] };
  const doc = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Section" }] }, paragraph, { type: "paragraph" }, { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [paragraph] }] }, { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [paragraph] }] }, { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [paragraph] }] }] }] };
  validateDocument(doc);
  const stored = getSchema(procedureExtensions()).nodeFromJSON(doc).toJSON();
  assert.deepEqual(getSchema(procedureExtensions()).nodeFromJSON(stored).toJSON(), stored);
  assert.equal(documentText(stored), documentText(doc));
  assert.deepEqual(procedureDocument({ steps: ["Legacy retained"], content: { runfloorDocument: { format: "tiptap-v1", document: stored } } }), stored);
});
test("Unsafe links, unknown nodes, and unsupported formatting are rejected", () => {
  assert.throws(() => validateDocument({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] }));
  assert.throws(() => validateDocument({ type: "doc", content: [{ type: "script" }] }));
  assert.throws(() => validateDocument({ type: "doc", content: [{ type: "paragraph", attrs: { onclick: "evil" } }] }));
});
test("Platform template editing excludes tenant roles and demo viewers", () => {
  for (const role of ["tenant_admin", "manager", "salesperson"]) assert.equal(isPlatformTemplateEditor({ role }), false);
  assert.equal(isPlatformTemplateEditor(null), false);
  assert.equal(isPlatformTemplateEditor({ role: "platform_owner", demo: true }), false);
  assert.equal(isPlatformTemplateEditor({ role: "platform_owner", demo: false }), true);
});
test("Back links remain local with encoded search/category context", () => {
  assert.equal(templateReturnPath("Sales", "closing"), "/admin/platform?category=Sales&templateSearch=closing#procedure-library-heading");
  assert.ok(templateReturnPath("//evil.test", "?foo").startsWith("/admin/platform?category=%2F%2Fevil.test"));
});
