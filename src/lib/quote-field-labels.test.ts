import assert from "node:assert/strict";
import test from "node:test";
import { defaultQuoteLabels, restoreQuoteLabels } from "./quote-field-labels.ts";

test("older drafts keep default labels; custom names stay scoped to known fields", () => {
  assert.deepEqual(restoreQuoteLabels(undefined), defaultQuoteLabels);
  assert.deepEqual(restoreQuoteLabels({ docFees: "  Documentation\nfee ", salesTax: " ", vehiclePrice: 12, extra: "Ignore" }), { ...defaultQuoteLabels, docFees: "Documentation fee" });
  assert.equal(restoreQuoteLabels({ accessories: "x".repeat(80) }).accessories.length, 60);
});
