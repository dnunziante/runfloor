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
test("every OpenAI transport remains centralized behind reservations", () => {
  const transports = files("src")
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file) && !file.includes(".test."))
    .filter((file) => readFileSync(file, "utf8").includes("api.openai.com"));
  assert.deepEqual(
    transports.map((file) => file.replaceAll("\\", "/")),
    ["src/lib/ai-billing/provider.ts"],
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
