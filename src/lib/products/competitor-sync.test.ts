import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCompetitorIdentity, productSourceHash } from "./competitor-sync.ts";
test("normalizes predictable competitor model variations", () => { assert.equal(normalizeCompetitorIdentity("EPIC E-40 FX", "Epic"), "e40fx"); assert.notEqual(normalizeCompetitorIdentity("E40"), normalizeCompetitorIdentity("E40L")); });
test("hash ignores field order", () => { assert.equal(productSourceHash({model:"E40",range:"50"}), productSourceHash({range:"50",model:"E40"})); });
