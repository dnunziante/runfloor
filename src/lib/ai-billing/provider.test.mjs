import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { boundRequest, providerUsage } from "./money.ts";
function provider({
  reserveError = null,
  response = {
    ok: true,
    status: 200,
    usage: { prompt_tokens: 100, completion_tokens: 10 },
  },
  settlementError = null,
  network = false,
} = {}) {
  const calls = [];
  const deps = {
    "server-only": {},
    "node:crypto": { createHash },
    "next/headers": {
      headers: async () =>
        new Headers({
          "x-runfloor-ai-request": "10000000-0000-0000-0000-000000000001",
        }),
    },
    "node:async_hooks": { AsyncLocalStorage },
    "@/lib/auth/viewer": {
      getViewer: async () => ({ id: "user", organizationId: "company" }),
    },
    "@/lib/supabase/admin": {
      createAdminClient: () => ({
        rpc: async (name, args) => {
          calls.push({ name, args });
          return {
            error: name === "reserve_ai_usage" ? reserveError : settlementError,
            data: { state: args.outcome },
          };
        },
      }),
    },
    "./money": { boundRequest, providerUsage },
  };
  const exports = {};
  const source = ts.transpileModule(
    readFileSync("src/lib/ai-billing/provider.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    exports,
    require: (name) => {
      assert.ok(name in deps, name);
      return deps[name];
    },
    process: { env: { OPENAI_API_KEY: "test-placeholder" } },
    crypto,
    Headers,
    AbortSignal,
    fetch: async () => {
      calls.push({ name: "fetch" });
      if (network) throw new Error("timeout");
      return {
        ...response,
        headers: new Headers({ "x-request-id": "req_test" }),
        json: async () => ({ usage: response.usage, choices: [] }),
      };
    },
  });
  return {
    calls,
    request: () =>
      exports.meteredOpenAI(
        "chat/completions",
        { model: "gpt-5-mini", messages: [] },
        "assistant",
      ),
  };
}
test("exhaustion stops before any provider call", async () => {
  const p = provider({ reserveError: { message: "Insufficient credits" } });
  await assert.rejects(p.request(), /insufficient AI credits/);
  assert.deepEqual(
    p.calls.map((c) => c.name),
    ["reserve_ai_usage"],
  );
});
test("confirmed provider usage settles after reservation", async () => {
  const p = provider();
  await p.request();
  assert.deepEqual(
    p.calls.map((c) => c.name),
    ["reserve_ai_usage", "fetch", "finish_ai_usage"],
  );
  assert.equal(p.calls[2].args.actual_input, 100);
  assert.equal(p.calls[2].args.outcome, "settled");
});
test("ambiguous provider failures retain reservations", async () => {
  for (const options of [
    { network: true },
    { response: { ok: false, status: 500, usage: null } },
    { response: { ok: true, status: 200, usage: null } },
  ]) {
    const p = provider(options);
    await assert.rejects(p.request(), /reserved/);
    assert.equal(p.calls.at(-1).args.outcome, "uncertain");
  }
});
test("explicit unbilled rejection releases reservation", async () => {
  const p = provider({ response: { ok: false, status: 429, usage: null } });
  await assert.rejects(p.request(), /rejected/);
  assert.equal(p.calls.at(-1).args.outcome, "released");
});
test("accounting failure never reports success", async () => {
  const p = provider({ settlementError: { message: "offline" } });
  await assert.rejects(p.request(), /reconciliation/);
});
