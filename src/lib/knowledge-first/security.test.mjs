import * as planPolicy from "../plans/policy.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(file, dependencies, globals = {}) {
  dependencies={"@/lib/plans/policy":planPolicy,...dependencies};
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (name) => { assert.ok(name in dependencies, name); return dependencies[name]; }, Response, File, crypto, ...globals });
  return exports;
}
test("Sales requests enforce authentication, demo restriction and question limits before the pipeline", async () => {
  for (const [viewer, question, status] of [[null, "Test", 401], [{ organizationId: "a", demo: true }, "Test", 403], [{ organizationId: "a" }, "", 400]]) {
    let called = false;
    const route = load("src/app/api/assistant/route.ts", { "next/server": { NextResponse: Response }, "@/lib/auth/viewer": { getViewer: async () => viewer }, "@/lib/assistant/workspaces": { conversationContext: () => "" }, "@/lib/assistant/workspace-context": {}, "@/lib/rag/prompt-compiler": {}, "@/lib/supabase/server": { createClient: () => { throw new Error("must not retrieve before auth"); } }, "@/lib/rag/openai": {}, "@/lib/rag/product-context": {}, "@/lib/rag/communication-context": {}, "@/lib/knowledge-first/runtime": { runKnowledgeAssistant: async () => { called = true; } }, "@/lib/knowledge-first/stream": { knowledgeResponse: async (work) => work() } });
    const response = await route.POST({ json: async () => ({ question }) }); assert.equal(response.status, status); assert.equal(called, false);
  }
});
test("settings, document access and knowledge approval deny ordinary users before any mutation", async () => {
  for (const [file, method] of [["settings/route.ts", "PUT"], ["documents/[id]/route.ts", "PATCH"], ["gaps/[id]/route.ts", "PUT"]]) {
    const route = load(`src/app/api/ai-knowledge/${file}`, { "@/lib/knowledge-first/admin": { knowledgeAdmin: async () => null }, "@/lib/supabase/admin": { createAdminClient: () => { throw new Error("must not reach service role"); } } });
    const response = await route[method]({}, { params: Promise.resolve({ id: "other-tenant-document" }) }); assert.equal(response.status, 403);
  }
});
function approvalFixture({ indexing = true, foreign = false } = {}) {
  const writes = []; const document = []; let gapStatus = "open";
  const db = {
    storage: { from: () => ({ upload: async (path) => { writes.push(["upload", path]); return { error: null }; } }) },
    from(table) {
      let operation = "read"; let fields; const filters = [];
      const query = {
        select() { return this; }, update(value) { operation = "update"; fields = value; return this; }, insert(value) { operation = "insert"; fields = value; return this; },
        eq(key, value) { filters.push([key, value]); return this; }, neq() { return this; }, in() { return this; },
        maybeSingle() { return this.then((value) => value); },
        then(resolve) {
          assert.ok(filters.some(([key, value]) => key === "organization_id" && value === "tenant-a") || operation === "insert" && fields.organization_id === "tenant-a");
          if (operation !== "read") { writes.push([table, operation, fields]); if (table === "knowledge_documents") document.push(fields); if (table === "ai_knowledge_gaps" && fields.status) gapStatus = fields.status; }
          const data = foreign ? null : table === "ai_knowledge_gaps" ? { id: "gap-a", status: gapStatus, document_id: null } : null;
          return Promise.resolve(resolve({ data, error: null }));
        },
      }; return query;
    },
  };
  const admin = load("src/lib/knowledge-first/admin.ts", { "server-only": {}, "@/lib/auth/viewer": {}, "@/lib/supabase/server": {}, "@/lib/supabase/admin": { createAdminClient: () => db }, "@/lib/rag/process-document": { processKnowledgeDocument: async (input) => { writes.push(["index", input]); return { indexed: indexing }; } }, "@/lib/knowledge/collections": { isKnowledgeCollection: (value) => value === "General" }, "./policy": {} });
  const viewer = { organizationId: "tenant-a", id: "admin-a", role: "tenant_admin", demo: false };
  const draft = { title: "Approved guidance", answer: "Reviewed dealership guidance.", collection: "General", scopes: ["sales"], managementOnly: false, approve: true };
  return { admin, viewer, draft, writes, document, status: () => gapStatus };
}
test("admin role checks reject managers, salespeople, demos and absent tenants", () => { const f = approvalFixture(); for (const viewer of [null, { role: "manager", organizationId: "a" }, { role: "salesperson", organizationId: "a" }, { role: "tenant_admin", organizationId: "a", demo: true }]) assert.equal(f.admin.isKnowledgeAdmin(viewer), false); assert.equal(f.admin.isKnowledgeAdmin(f.viewer), true); });
test("saving a knowledge draft never indexes or promotes external content", async () => { const f = approvalFixture(); await f.admin.saveGapDraft(f.viewer, "gap-a", { ...f.draft, approve: false }); assert.equal(f.writes.some(([action]) => action === "upload" || action === "index" || action === "knowledge_documents"), false); assert.equal(f.status(), "draft"); });
test("explicit administrator approval reuses private storage and the existing indexer before resolving", async () => { const f = approvalFixture(); const result = await f.admin.saveGapDraft(f.viewer, "gap-a", f.draft); assert.equal(result.indexed, true); assert.equal(f.status(), "resolved"); assert.equal(f.document[0].knowledge_authority, "approved"); assert.equal(f.document[0].organization_id, "tenant-a"); assert.ok(f.writes.find(([action]) => action === "index")); });
test("failed indexing preserves a retryable draft and never resolves the gap", async () => { const f = approvalFixture({ indexing: false }); await assert.rejects(f.admin.saveGapDraft(f.viewer, "gap-a", f.draft), /indexing failed/); assert.equal(f.status(), "draft"); assert.equal(f.writes.some(([table, , value]) => table === "ai_knowledge_gaps" && value?.status === "resolved"), false); });
test("another tenant's gap cannot enter the approval or indexing flow", async () => { const f = approvalFixture({ foreign: true }); await assert.rejects(f.admin.saveGapDraft(f.viewer, "gap-other", f.draft), /not found/); assert.equal(f.writes.length, 0); });
