import assert from "node:assert/strict";
import test from "node:test";
import { compileRunFloorPrompt, defaultCommunicationStandards, globalResponsePresentationStandard, normalizeStandards } from "./prompt-compiler.ts";

test("all compiled prompts include the global response presentation standard", () => {
  const prompt = compileRunFloorPrompt({ featureInstructions: "Answer the user.", approvedKnowledge: "Approved context.", userRequest: "Help me." });
  assert.ok(prompt.includes(globalResponsePresentationStandard));
  assert.ok(prompt.includes("### What to Say"));
  assert.ok(prompt.includes("strict JSON"));
});

test("unset and invalid tenant settings retain safe communication defaults", () => {
  const standards = normalizeStandards({
    tone: undefined,
    responseLength: undefined,
    useBullets: undefined,
    competitorBehavior: "invalid" as never,
  });

  assert.deepEqual(standards, defaultCommunicationStandards);
  assert.doesNotThrow(() => compileRunFloorPrompt({
    featureInstructions: "Answer the user.",
    standards,
    approvedKnowledge: "Approved context.",
    userRequest: "Help me with marketing.",
  }));
});
