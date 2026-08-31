import assert from "node:assert/strict";
import test from "node:test";
import { compileRefyntraPrompt, globalResponsePresentationStandard } from "./prompt-compiler.ts";

test("all compiled prompts include the global response presentation standard", () => {
  const prompt = compileRefyntraPrompt({ featureInstructions: "Answer the user.", approvedKnowledge: "Approved context.", userRequest: "Help me." });
  assert.ok(prompt.includes(globalResponsePresentationStandard));
  assert.ok(prompt.includes("### What to Say"));
  assert.ok(prompt.includes("strict JSON"));
});
