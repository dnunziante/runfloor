import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as permissions from "../auth/role-permissions.ts";
import * as plans from "../plans/policy.ts";
import * as presentation from "../products/presentation.ts";
import * as specifications from "../products/golf-cart-specifications.ts";

function load(path, dependencies) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, { exports, Error, require: name => {
    assert.ok(Object.hasOwn(dependencies, name), name);
    return dependencies[name];
  } });
  return exports;
}

const access = load("src/lib/products/compare-sell.ts", {
  "@/lib/auth/role-permissions": permissions,
  "@/lib/plans/policy": plans,
});
const ids = [1, 2, 3].map(id => `10000000-0000-0000-0000-00000000000${id}`);
const products = [
  { id: ids[0], name: "Beyond", productType: "our_product", model: "Beyond", modelYear: 2027, brand: "Bintelli", modelVariant: "4FF", highlights: ["Power steering"], specifications: { frameMaterial: "Aluminum", originalSource: "internal import metadata" } },
  { id: ids[1], name: "S4F", productType: "competitor_product", model: "S4F", modelYear: 2026, brand: "Aries EV", modelVariant: "2WD", highlights: [], specifications: { powerSteering: "" } },
  { id: ids[2], name: "Onward", productType: "our_product", model: "Onward", brand: "Club Car", highlights: [] },
];

function fixture({ viewer = { organizationId: "tenant-a", role: "salesperson" }, records = products, industry = "golf-cart", creditError } = {}) {
  const calls = [];
  const { POST } = load("src/app/api/assistant/compare/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/auth/viewer": { getViewer: async () => viewer },
    "@/lib/organizations/industry": { getViewerIndustryTemplateKey: async () => industry },
    "@/lib/products/compare-sell": access,
    "@/lib/products/data": {
      getApprovedComparisonProducts: async (...args) => { calls.push(["workspace", ...args]); return records; },
      getSoloSharedCatalog: async options => { calls.push(["shared", options]); return { products: records }; },
    },
    "@/lib/products/golf-cart-specifications": specifications,
    "@/lib/products/presentation": presentation,
    "@/lib/rag/openai": { createWorkspaceAnswer: async (...args) => {
      calls.push(["AI", ...args]);
      if (creditError) throw Object.assign(new Error(creditError), { name: "AiCreditError" });
      return "Compare how the steering feels in both models.";
    } },
  });
  return { calls, submit: patch => POST({ json: async () => ({ productIds: ids.slice(0, 2), action: "demo", ...patch }) }) };
}

test("Compare & Sell checks sign-in, plan, and both permissions before accessing catalog or AI", async () => {
  const role = { organizationId: "tenant-a", role: "salesperson" };
  for (const [viewer, status] of [
    [null, 401],
    [{ ...role, demo: true }, 401],
    [{ ...role, plan: { plan_key: "sales_solo_free" } }, 403],
    [{ ...role, permissions: { sales_ai: false, comparisons: true } }, 403],
    [{ ...role, permissions: { sales_ai: true, comparisons: false } }, 403],
  ]) {
    const request = fixture({ viewer });
    assert.equal((await request.submit()).status, status);
    assert.equal(request.calls.length, 0);
  }
});

test("Compare & Sell uses exact approved selections in order and treats missing competitor data as unconfirmed", async () => {
  const request = fixture({ records: [...products].reverse() });
  const response = await request.submit({ notes: "Easy steering", products: [{ name: "Forged client facts" }] });
  assert.equal(response.status, 200);
  assert.equal(request.calls[0][1], "tenant-a");
  const [, , context, instructions, preferences] = request.calls[1];
  const facts = JSON.parse(context);
  assert.deepEqual(facts.map(product => [product.title, product.year, product.variant]), [["2027 Bintelli Beyond 4FF", 2027, "4FF"], ["2026 Aries EV S4F 2WD", 2026, "2WD"]]);
  assert.deepEqual(facts[1].specifications, []);
  assert.doesNotMatch(context, /Forged client facts|internal import metadata|Onward/);
  assert.match(instructions, /unconfirmed/);
  assert.match(instructions, /Never infer a competitor lacks a feature/);
  assert.match(preferences, /Easy steering/);
  assert.equal((await response.json()).catalog, "RunFloor approved catalog");
});

test("Compare & Sell accepts three authorized RV models and rejects duplicate or unapproved selections", async () => {
  const request = fixture({ industry: "rv" });
  const response = await request.submit({ productIds: ids, catalog: "shared", action: "pitch" });
  assert.equal(response.status, 200);
  assert.equal(request.calls[0][0], "shared");
  assert.match(request.calls[1][3], /RV terminology/);
  assert.equal((await response.json()).sources.length, 3);
  const incomplete = fixture({ records: products.slice(0, 1) });
  assert.equal((await incomplete.submit()).status, 404);
  assert.equal((await incomplete.submit({ productIds: [ids[0], ids[0]] })).status, 400);
  assert.equal(incomplete.calls.length, 1);
});

test("Compare & Sell leads with the selected Our Product for all actions and preserves verified trade-offs", async () => {
  for (const [action, guidance] of [["pitch", /30-second pitch/], ["objection", /follow-up question/], ["demo", /side-by-side demo/]]) {
    for (const productIds of [ids.slice(0, 2), ids]) {
      for (const industry of ["golf-cart", "rv", null]) {
        const competitor = { ...products[1], specifications: { backupCamera: true, powerSteering: "" } };
        const own = { ...products[0], specifications: { ...products[0].specifications, backupCamera: false } };
        const request = fixture({ industry, records: [products[2], competitor, own] });
        const response = await request.submit({ action, productIds, notes: "A backup camera is a must-have." });
        assert.equal(response.status, 200);
        const { answer, sources } = await response.json();
        assert.match(answer, /^### Start with 2027 Bintelli Beyond 4FF \[P1\]/);
        assert.equal(sources.length, productIds.length);
        const [, , context, instructions] = request.calls[1];
        const facts = JSON.parse(context);
        assert.deepEqual(facts.map(({ source, productType }) => [source, productType]), [
          ["[P1]", "Our Product"], ["[P2]", "Competitor Product"],
          ...(productIds.length === 3 ? [["[P3]", "Our Product"]] : []),
        ]);
        assert.deepEqual(facts[1].specifications, [["Backup Camera", "Yes"]]);
        assert.ok(facts[0].specifications.some(([label, value]) => label === "Backup Camera" && value === "No"));
        assert.match(instructions, guidance);
        assert.match(instructions, /strongest verified selling point/);
        assert.match(instructions, /Acknowledge verified competitor strengths/);
        assert.match(instructions, /without claiming overall superiority/);
        assert.match(instructions, /another model we carry would fit/);
        assert.match(instructions, /End with one practical next step/);
      }
    }
  }
});

test("Compare & Sell checks the selector roles against catalog records before metering AI", async () => {
  for (const productIds of [[ids[1], ids[0]], [ids[0], ids[2], ids[1]]]) {
    const request = fixture();
    assert.equal((await request.submit({ productIds })).status, 400);
    assert.equal(request.calls.filter(([name]) => name === "AI").length, 0);
  }
});

test("Compare & Sell returns metering restrictions after a single AI attempt", async () => {
  for (const creditError of ["Your company has insufficient AI credits for this request.", "Credits remain reserved for review."]) {
    const request = fixture({ creditError });
    const response = await request.submit({ action: "objection" });
    assert.equal(response.status, 402);
    assert.equal((await response.json()).error, creditError);
    assert.equal(request.calls.filter(([name]) => name === "AI").length, 1);
  }
});
