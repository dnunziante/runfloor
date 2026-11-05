import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import ts from "typescript";
import { isFeatureDestinationEnabled } from "./features.ts";
const require = createRequire(import.meta.url);

function load(file, dependencies) {
  const source = readFileSync(file, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, URL, process, require: (name) => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; } });
  return exports;
}

test("the actual proxy rejects coaching before authentication and demo bypasses", async () => {
  for (const enabled of [false, true]) {
    const { proxy } = load("src/proxy.ts", {
      "@/lib/features": { isFeatureDestinationEnabled: (path) => isFeatureDestinationEnabled(path, enabled) },
      "@supabase/ssr": { createServerClient: () => { throw new Error("Unexpected database access"); } },
      "@/lib/supabase/config": { isLocalDemoMode: () => true },
      "next/server": { NextResponse: { next: () => ({ next: true }), redirect: (url) => ({ status: 307, url: url.href }), json: (body, { status }) => ({ body, status }) } },
    });
    for (const path of ["/coach", "/training/lesson-a", "/objections", "/role-play", "/coach/session?scenario=a", "/admin/coach", "/admin/training"]) {
      const result = await proxy({ nextUrl: new URL(`https://test.example${path}`), url: `https://test.example${path}`, method: "GET", cookies: { get: () => undefined } });
      if (enabled) assert.equal(result.next, true); else { assert.equal(result.status, 307); assert.equal(result.url, "https://test.example/dashboard"); }
    }
    for (const path of ["/api/coach/session", "/api/admin/coach/scenario-import", "/api/knowledge/documents/a/training", "/training/lesson-a"]) {
      const result = await proxy({ nextUrl: new URL(`https://test.example${path}`), url: `https://test.example${path}`, method: "POST", cookies: { get: () => undefined } });
      assert.equal(enabled ? result.next : result.status, enabled ? true : 403);
    }
  }
});

test("each server layout blocks direct rendering while disabled and restores its original children when enabled", () => {
  for (const path of ["coach", "training", "objections", "role-play", "admin/coach", "admin/training"]) for (const enabled of [false, true]) {
    const layout = load(`src/app/${path}/layout.tsx`, { "@/lib/features": { ENABLE_SALES_COACHING: enabled }, "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } } }).default;
    if (enabled) assert.equal(layout({ children: "original module" }), "original module");
    else assert.throws(() => layout({ children: "original module" }), /redirect:\/dashboard/);
  }
});

test("shared entry-point links disappear while disabled and return intact when enabled", () => {
  for (const enabled of [false, true]) {
    const { FeatureLink } = load("src/components/feature-link.tsx", {
      "react/jsx-runtime": require("react/jsx-runtime"),
      "next/link": { __esModule: true, default: (props) => React.createElement("a", props) },
      "@/lib/features": { isFeatureDestinationEnabled: (path) => isFeatureDestinationEnabled(path, enabled) },
    });
    assert.equal(FeatureLink({ href: "/training/lesson-a", children: "Continue training" }) === null, !enabled);
    assert.equal(FeatureLink({ href: { pathname: "/coach/session", query: { scenario: "a" } }, children: "Start role play" }) === null, !enabled);
    assert.notEqual(FeatureLink({ href: "/assistant", children: "Sales AI" }), null);
  }
});

test("Knowledge Base keeps uploads and reindexing while hiding every training control, reversibly", () => {
  for (const enabled of [false, true]) for (const template of ["generic", "rv", "golf-cart"]) {
    const { FeatureLink } = load("src/components/feature-link.tsx", {
      "react/jsx-runtime": require("react/jsx-runtime"),
      "next/link": { __esModule: true, default: (props) => React.createElement("a", props) },
      "@/lib/features": { isFeatureDestinationEnabled: (path) => isFeatureDestinationEnabled(path, enabled) },
    });
    const collections = load("src/lib/knowledge/collections.ts", {});
    const { KnowledgeManager } = load("src/components/knowledge-manager.tsx", {
      react: require("react"), "react/jsx-runtime": require("react/jsx-runtime"), "lucide-react": require("lucide-react"),
      "@/lib/features": { ENABLE_SALES_COACHING: enabled },
      "@/components/feature-link": { FeatureLink },
      "next/navigation": { useRouter: () => ({ refresh() {}, push() {} }) },
      "@/app/knowledge-base/actions": { deleteKnowledgeDocument() {}, reindexKnowledgeDocument() {}, updateKnowledgeDocumentCollection() {} },
      "@/lib/knowledge/collections": collections,
    });
    const html = renderToStaticMarkup(React.createElement(KnowledgeManager, { canManage: true, isRv: template === "rv", isGolfCart: template === "golf-cart", documents: [{ id: "doc-a", title: "Approved product guide", filename: "guide.pdf", collection: "Product knowledge", status: "Ready", sizeBytes: 1000, createdAt: "2026-11-05", chunkCount: 3, trainingLessonId: "lesson-a", trainingLessonStatus: "ready", trainingLessonPublished: true }] }));
    assert.ok(html.includes("Upload securely"), template);
    assert.ok(html.includes("Re-index"), template);
    assert.equal(html.includes('name="addToTraining"'), enabled, template);
    assert.equal(html.includes("Build module with selected"), false); // no selected records
    assert.equal(html.includes("Select indexed knowledge uploads to build a module."), enabled, template);
    assert.equal(html.includes("Edit &amp; republish"), enabled, template);
    assert.equal(html.includes('href="/training/lesson-a/review"'), enabled, template);
  }
});
