import test from "node:test";
import assert from "node:assert/strict";
import { productPrice, productTitle, rvCategory, visibleSpecification, specificationValue } from "./presentation.ts";
test("legacy missing MSRP differs from explicit zero sale price",()=>{
 assert.equal(productPrice({price:0}),null);
 assert.equal(productPrice({price:0,salePrice:0}),0);
 assert.equal(productPrice({price:100,salePrice:90}),90);
});
test("catalog display preserves year and model without repeated title parts",()=>{
 assert.equal(productTitle({name:"2026 Brinkley Model G 3250",brand:"Brinkley",modelYear:2026,model:"3250"}),"2026 Brinkley Model G 3250");
 assert.equal(productTitle({name:"UX QA Brinkley Model G 3250",brand:"UX QA Brinkley",modelYear:2026,model:"3250"}),"2026 UX QA Brinkley Model G 3250");
 assert.equal(rvCategory("Fifth Wheels"),"Fifth Wheel");
 assert.equal(rvCategory("Travel Trailer"),rvCategory("Travel Trailers"));
 assert.equal(rvCategory("Mercedes chassis"),"Other RV");
 assert.equal(visibleSpecification("gvwrDerived"),false);
 assert.equal(specificationValue("overallLengthFt",30.5),"30 ft 6 in");
 assert.equal(specificationValue("dryWeightLb",12345),"12,345 lb");
});
