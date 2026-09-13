import assert from "node:assert/strict";
import test from "node:test";
import { formatProductContext, selectRelevantProducts, type ApprovedProduct } from "./product-context.ts";

const products: ApprovedProduct[] = [
  { id: "1", name: "Beyond", model: "4 Passenger Forward", description: "Refined everyday cart", base_price_cents: 1349500, range_text: "40 miles", seats_text: "4", powertrain_text: "48V", dimensions: null, running_distance: null, turning_radius: null, max_load_capacity: null, highlights: ["Aluminum frame"], sales_guide: {} },
  { id: "2", name: "Nexus", model: "4 Passenger", description: "Premium cart", base_price_cents: 1599500, range_text: "55 miles", seats_text: "4", powertrain_text: "72V", dimensions: null, running_distance: null, turning_radius: null, max_load_capacity: null, highlights: [], sales_guide: {} },
];

test("selects the named approved product", () => assert.deepEqual(selectRelevantProducts("What is the price of a Beyond?", products).map((product) => product.name), ["Beyond"]));
test("formats catalog price and source", () => {
  const context = formatProductContext(products[0]);
  assert.match(context, /Product catalog — Beyond/);
  assert.match(context, /\$13,495\.00/);
});

test("makes numeric and boolean RV specifications available to AI context", () => {
  const context = formatProductContext({ ...products[0], specifications: { freshWaterGal: 81, hitchWeightLb: 2165, primaryBed: "king", slides: 3, awning: false } });
  assert.match(context, /fresh Water Gal: 81/i);
  assert.match(context, /hitch Weight Lb: 2165/i);
  assert.match(context, /primary Bed: king/i);
  assert.match(context, /slides: 3/i);
  assert.match(context, /awning: No/i);
});
