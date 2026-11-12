import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { selectWorkspaceContext } from "./workspace-context.ts";
import ts from "typescript";
import { assistantWorkspaces, canUseAssistant, conversationContext } from "./workspaces.ts";

// Execute the actual route with isolated service doubles. This tests authorization
// before retrieval and ensures each assistant invokes only its permitted sources.
function route(viewer, operationsOverride) {
  const calls = []; let suppliedContext = "";
  const query = { select() { return this; }, eq(key, value) { calls.push([key, value]); return this; }, limit() { return Promise.resolve({ data: [], error: null }); } };
  const dependencies = {
    "@/lib/assistant/workspace-context": { selectWorkspaceContext },
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    "@/lib/auth/viewer": { getViewer: async () => viewer },
    "@/lib/assistant/workspaces": { assistantWorkspaces, canUseAssistant, conversationContext },
    "@/lib/rag/openai": { createWorkspaceAnswer: async (_question, context) => { calls.push("model"); suppliedContext = context; return "Grounded answer"; } },
    "@/lib/operations/repository": { getOperationsWorkspace: async () => { calls.push("operations"); if (operationsOverride instanceof Error) throw operationsOverride; if (operationsOverride) return operationsOverride; return { error: "", procedures: [{ title: "Published SOP", status: "Published" }, { title: "Private draft", status: "Draft" }], checklists: [], alerts: [], schedules: [], handoffs: [], incidents: [] }; } },
    "@/lib/executive/repository": { getExecutiveWorkspace: async () => { calls.push("executive"); return { canView: true, reportingPeriod: "2026-11", metrics: [], priorities: [] }; } },
    "@/lib/growth/plans": { getGrowthPlans: async () => { calls.push("plans"); return { plans: [], error: "" }; } },
    "@/lib/executive/trends-repository": { getExecutiveTrends: async () => { calls.push("trends"); return { periods: [], error: "" }; } },
    "@/lib/supabase/server": { createClient: async () => ({ from: () => query }) },
  };
  const source = readFileSync("src/app/api/workspace-assistant/[workspace]/route.ts", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return { post: (workspace, question = "What needs attention?") => exports.POST({ json: async () => ({ question }) }, { params: Promise.resolve({ workspace }) }), calls, context: () => suppliedContext };
}

test("anonymous, demo and unauthorized Executive requests never retrieve data or invoke AI", async () => {
  for (const [viewer, status] of [[null, 401], [{ organizationId: "a", role: "salesperson" }, 403], [{ organizationId: "a", role: "manager", demo: true }, 403]]) {
    const request = route(viewer); assert.equal((await request.post("executive")).status, status); assert.deepEqual(request.calls, []);
  }
});

test("unknown workspaces and invalid questions fail before data retrieval", async () => {
  const request = route({ organizationId: "a", role: "manager" });
  assert.equal((await request.post("sales")).status, 404);
  assert.equal((await request.post("operations", "")).status, 400);
  assert.equal((await request.post("operations", "x".repeat(2001))).status, 400);
  assert.deepEqual(request.calls, []);
});

test("Operations uses published operational sources without Executive or Growth context", async () => {
  const request = route({ organizationId: "a", role: "salesperson" });
  assert.equal((await request.post("operations")).status, 200);
  assert.deepEqual(request.calls, ["operations", "model"]);
  assert.ok(request.context().includes("Published SOP"));
  assert.equal(request.context().includes("Private draft"), false);
});

test("Executive uses management sources and scopes opportunity queries to the active tenant", async () => {
  const request = route({ organizationId: "tenant-a", role: "manager" });
  assert.equal((await request.post("executive")).status, 200);
  assert.ok(request.calls.includes("executive")); assert.ok(request.calls.includes("plans")); assert.ok(request.calls.includes("trends"));
  assert.equal(request.calls.includes("operations"), false);
  assert.ok(request.calls.some((call) => Array.isArray(call) && call[0] === "organization_id" && call[1] === "tenant-a"));
});

test('large Operations workspaces answer instead of rejecting context size', async () => {
 const request=route({organizationId:'tenant-a',role:'salesperson'},{error:'',procedures:[{title:'Test drive',status:'Published',content:'Review safety. '.repeat(20000)+'Confirm appointment with sales.'}],checklists:[],alerts:[],schedules:[],handoffs:[],incidents:[]});
 assert.equal((await request.post('operations','Help me schedule a test drive')).status,200);
 assert.ok(request.context().length<61000);
 assert.ok(request.calls.includes('model'));
});
test('unavailable Operations records still permit honestly labeled general help', async () => {
 for (const failure of [new Error('private-database-details'),{error:'private-database-details'}]) {
  const request=route({organizationId:'tenant-a',role:'salesperson'},failure);
  const response=await request.post('operations','Help plan a test drive');
  assert.equal(response.status,200);
  assert.ok(request.context().includes('General AI guidance'));
  assert.equal(request.context().includes('private-database-details'),false);
  assert.equal(response.body.sources.length,0);
 }
});
