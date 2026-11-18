import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(path.join(dir, entry.name))
      : [path.join(dir, entry.name)],
  );
}
test("OpenAI transports are limited to dealership billing and the explicit platform-help exception", () => {
  const transports = files("src")
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file) && !file.includes(".test."))
    .filter((file) => readFileSync(file, "utf8").includes("api.openai.com"));
  assert.deepEqual(
    transports.map((file) => file.replaceAll("\\", "/")),
    ["src/lib/ai-billing/provider.ts", "src/lib/opal/provider.ts"],
  );
});
test("all current shared billable helpers have distinct accounting feature names", () => {
  const source = readFileSync("src/lib/rag/openai.ts", "utf8");
  for (const name of [
    "createEmbeddings",
    "createGroundedAnswer",
    "createGeneratedChecklist",
    "createRevisedProcedure",
    "createImportedProcedure",
    "createGroundedTrainingLesson",
    "createSalesEmail",
    "createSalesText",
    "extractCustomerTextTemplates",
    "createWorkspaceAnswer",
  ])
    assert.ok(source.includes(`, "${name}")`), name);
});

test("platform help cannot retrieve business repositories; Solo calls share its allowance",()=>{const source=readFileSync("src/lib/opal/provider.ts","utf8");assert.doesNotMatch(source,/workspace-context|operations\/repository|executive\/repository/);assert.match(source,/max_completion_tokens:1600/);assert.match(source,/store:false/);assert.match(source,/plan_key==='sales_solo'/);assert.match(source,/meteredOpenAI\("chat\/completions",payload,"help_assistant"\)/);});
