import test from "node:test";
import assert from "node:assert/strict";
import {
  boundRequest,
  costUnits,
  providerUsage,
  validCreditSummary,
} from "./money.ts";
const rate = {
  input_units_per_million: 25000000,
  cached_units_per_million: 2500000,
  output_units_per_million: 200000000,
};
test("fractional credits retain precision and cached/reasoning cost is correct", () => {
  assert.equal(
    costUnits({ input: 1000, cached: 200, output: 100, reasoning: 50 }, rate),
    40500,
  );
  assert.equal(
    costUnits({ input: 1, cached: 0, output: 0, reasoning: 0 }, rate),
    25,
  );
});
test("provider usage refuses malformed or missing billing evidence", () => {
  assert.equal(providerUsage({}), null);
  assert.equal(
    providerUsage({
      usage: {
        prompt_tokens: 1,
        completion_tokens: 2,
        prompt_tokens_details: { cached_tokens: 3 },
      },
    }),
    null,
  );
  assert.deepEqual(providerUsage({ usage: { total_tokens: 7 } }, true), {
    input: 7,
    cached: 0,
    output: 0,
    reasoning: 0,
  });
});
test("bounded operations cap output, reject oversized input and remote images", () => {
  const bounded = boundRequest("chat/completions", {
    model: "gpt-5-mini",
    messages: [{ role: "user", content: "hello" }],
    max_tokens: 999999,
  });
  assert.equal(bounded.payload.max_completion_tokens, 8192);
  assert.equal("max_tokens" in bounded.payload, false);
  assert.throws(
    () => boundRequest("chat/completions", { messages: "x".repeat(210000) }),
    /too large/,
  );
  assert.throws(
    () =>
      boundRequest("chat/completions", {
        image_url: { url: "https://example.com/private" },
      }),
    /Remote images/,
  );
  assert.equal(boundRequest("embeddings", { input: "hello" }).output, 0);
});
test("invalid balances are never presented as real", () => {
  assert.equal(validCreditSummary({}), false);
  assert.equal(validCreditSummary(null), false);
  assert.equal(validCreditSummary({ included_units: NaN }), false);
});
