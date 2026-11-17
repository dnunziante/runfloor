import assert from "node:assert/strict";
import test from "node:test";
import { quoteReadiness } from "./quote-readiness.ts";
import { calculateQuote } from "./quote-calculator.ts";
import { calculatePricing } from "./pricing-calculator.ts";
const deal = { vehiclePrice:50000.25, accessories:1000.50, docFees:200, tradeIn:5000, discount:500, salesTax:2742.05, extendedWarranties:1000, tagTitleDmvFee:150, destination:500, delivery:250 };
test("unknown, explicit zero, invalid amounts and unreviewed deals cannot be shared", () => {
 assert.match(quoteReadiness({...deal,vehiclePrice:0},false,true),/not provided/);
 assert.match(quoteReadiness({...deal,vehiclePrice:0},true,true),/greater than zero/);
 for (const amount of [-1,NaN,Infinity]) assert.match(quoteReadiness({...deal,delivery:amount},true,true),/valid/);
 assert.match(quoteReadiness(deal,true,false),/Review/);
 assert.match(quoteReadiness({...deal,tradeIn:999999},true,true),/exceed/);
 assert.equal(quoteReadiness(deal,true,true),"");
});
test("finance terms must be explicit, while verified zero APR is valid", () => {
 const terms = {downPayment:5000,apr:0,termMonths:60,acquisitionCostRate:1};
 assert.equal(quoteReadiness(deal,true,true,terms),"");
 assert.match(quoteReadiness(deal,true,true,{...terms,apr:NaN}),/financing/);
 assert.match(quoteReadiness(deal,true,true,{...terms,apr:101}),/financing/);
});
test("approved test figures retain cents from quote through financing", () => {
 const quote = calculateQuote(deal);
 assert.equal(quote.subtotal,45700.75);
 assert.equal(quote.totalDelivered,50342.8);
 const finance = calculatePricing({totalFinanced:quote.totalDelivered,downPayment:5000,acquisitionCostRate:1,apr:6,termMonths:60});
 assert.equal(finance.amountFinanced,45846.23);
 assert.ok(Math.abs(finance.monthlyPayment - 886.33606546)<0.01);
});
