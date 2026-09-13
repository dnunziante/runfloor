import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import { parseTemplateProductSpreadsheet } from "./template-spreadsheet-import.ts";

function spreadsheetFile(rows: Array<Record<string, string>>) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Products");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new File([bytes], "products.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

test("imports every populated spreadsheet row and preserves extra columns as specifications", async () => {
  const csv = '"Product Name","Model","Manufacturer","Model Year","RV Type","Description","Floorplan","Shipping Weight","GVWR","Length","Sleeping Capacity","MSRP"\r\n"Touring 26","26BUD","Example RV","2027","Travel Trailer","Family RV","26BUD","6,724 lbs","8,500 lbs","29 ft 8 in","8","$32,995"\r\n"Summit 34","34RL","Example RV","2026","Fifth Wheel","Couples RV","34RL","10,000 lbs","12,000 lbs","36 ft","4","$54,995"';
  const result = await parseTemplateProductSpreadsheet(new File([csv], "rv-template-bulk-upload.csv", { type: "text/csv" }), "rv");

  assert.equal(result.products.length, 2);
  assert.equal(result.detectedFormat, "runfloor");
  assert.equal(result.products[0].model, "26BUD");
  assert.equal(result.products[0].modelYear, 2027);
  assert.equal(result.products[0].specifications.gvwr, "8,500 lbs");
});

test("uses Model as the product name when Product Name is blank", async () => {
  const { products: [product] } = await parseTemplateProductSpreadsheet(spreadsheetFile([{ Model: "MODEL-100", Category: "Utility" }]), "generic");
  assert.equal(product.name, "MODEL-100");
  assert.equal(product.category, "Utility");
});

test("finds an expanded RV header after a blank row and preserves typed and unknown specifications", async () => {
  const workbook = XLSX.utils.book_new();
  const headers = ["model_year", "Manufacturer", "brand", "line", "model", "Description", "model_year_label", "body_type", "dry_weight_lb", "gvwr_lb", "gvwr_derived", "cargo_capacity_lb", "hitch_weight_lb", "hitch_weight_basis", "hitch_kind", "length_ft", "width_ft", "exterior_height_ft", "interior_height_ft", "fresh_water_gal", "grey_water_gal", "black_water_gal", "sleeps", "axles", "slides", "tires", "air_conditioner", "refrigerator", "awning", "primary_bed", "layout", "msrp_usd", "future_field"];
  const values = [2021, "Jayco", "Jayco", "Eagle", "317RLOK", "Luxury fifth wheel", "2021 model", "Fifth Wheel", 11025, 12995, true, 1970, 2165, "published", "fifth wheel", 36.417, 8.5, 13.25, "", 81, 87, 50, 6, 2, 3, "ST235/80R16", true, true, false, "king", "rear living", 74995, "future value"];
  const rows = [[], headers, values];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Expanded");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const result = await parseTemplateProductSpreadsheet(new File([bytes], "Sample Bulk RV.xlsx"), "rv");
  const [product] = result.products;
  assert.equal(result.detectedFormat, "expanded");
  assert.equal(product.name, "2021 Jayco Eagle 317RLOK");
  assert.equal(product.specifications.dryWeightLb, 11025);
  assert.equal(product.specifications.gvwrDerived, true);
  assert.equal(product.specifications.freshWaterGal, 81);
  assert.equal(product.specifications.airConditioner, true);
  assert.equal(product.specifications.awning, false);
  assert.equal(product.specifications.msrpUsd, 74995);
  assert.equal(product.specifications.interiorHeightFt, null);
  assert.equal(product.specifications.futureField, "future value");
  assert.deepEqual(product.warnings, ["Preserved unmapped column: future_field"]);
});

test("recognizes a headerless expanded RV worksheet by its guarded column order", async () => {
  const workbook = XLSX.utils.book_new();
  const row = [2026, "", "Jayco", "Eagle", "360DBOK", "", "2026 Jayco Eagle", "Fifth Wheel", 12800, 14995, false, 2195, 2695, "dry", "pin", 43.083, 8.083, 12.583, 8.583, 81, 87, 87, 6, "", "", "ST235/80R16'H'", "", "", "", "", "", ""];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([row, row]), "Sheet1");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const result = await parseTemplateProductSpreadsheet(new File([bytes], "headerless-rvs.xlsx"), "rv");
  assert.equal(result.products.length, 2);
  assert.equal(result.detectedFormat, "expanded");
  assert.equal(result.products[0].name, "2026 Jayco Eagle 360DBOK");
  assert.equal(result.products[0].manufacturer, "Jayco");
  assert.equal(result.products[0].specifications.dryWeightLb, 12800);
  assert.equal(result.products[0].specifications.gvwrDerived, false);
  assert.match(result.errors[0], /header row was missing/);
});

test("ignores completely empty worksheets without reporting a correction error", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Model: "26BUD", Manufacturer: "Example RV" }]), "Products");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), "Sheet2");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const result = await parseTemplateProductSpreadsheet(new File([bytes], "products-with-empty-sheet.xlsx"), "rv");
  assert.equal(result.products.length, 1);
  assert.deepEqual(result.errors, []);
});
