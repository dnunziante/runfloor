import * as XLSX from "xlsx";
import type { ProductExtractionIndustry } from "./document-extraction";

export type SpecificationValue = string | number | boolean | null;
export type SpreadsheetProduct = { name: string; model: string; manufacturer: string; modelYear: number | null; modelVariant: string; category: string; description: string; specifications: Record<string, SpecificationValue>; warnings: string[]; sourceRow: number };
export type SpreadsheetImportResult = { products: SpreadsheetProduct[]; totalRows: number; errors: string[]; detectedFormat: "runfloor" | "expanded" };

const commonAliases: Record<string, string> = { productname: "name", name: "name", model: "model", manufacturer: "manufacturer", modelyear: "modelYear", year: "modelYear", description: "description", productcategory: "category", category: "category", rvtype: "category", type: "category", bodytype: "category" };
const rvAliases: Record<string, string> = {
  brand: "brand", line: "productLine", modelyearlabel: "modelYearLabel", floorplan: "floorplan", layout: "floorplan",
  shippingweight: "shippingWeight", dryweight: "dryWeight", dryweightlb: "dryWeightLb", uvw: "dryWeightLb", unloadedvehicleweight: "dryWeightLb",
  gvwr: "gvwr", gvwrlb: "gvwrLb", gvwrderived: "gvwrDerived", cargocapacitylb: "cargoCapacityLb", carryingcapacity: "carryingCapacity",
  hitchweight: "hitchWeight", hitchweightlb: "hitchWeightLb", hitchweightbasis: "hitchWeightBasis", hitchkind: "hitchKind",
  length: "overallLength", lengthft: "lengthFt", widthft: "widthFt", exteriorheightft: "exteriorHeightFt", interiorheightft: "interiorHeightFt",
  freshwatergal: "freshWaterGal", greywatergal: "grayWaterGal", graywatergal: "grayWaterGal", blackwatergal: "blackWaterGal",
  sleepingcapacity: "sleepingCapacity", sleepcapacity: "sleepingCapacity", sleepsupto: "sleepingCapacity", sleeps: "sleeps",
  axles: "axles", slides: "slides", tires: "tires", airconditioner: "airConditioner", refrigerator: "refrigerator", awning: "awning", primarybed: "primaryBed",
  msrp: "msrp", msrpusd: "msrpUsd", price: "msrp", suggestedretailprice: "msrp",
};
const numericKeys = new Set(["dryWeightLb", "gvwrLb", "cargoCapacityLb", "hitchWeightLb", "lengthFt", "widthFt", "exteriorHeightFt", "interiorHeightFt", "freshWaterGal", "grayWaterGal", "blackWaterGal", "sleeps", "axles", "slides", "msrpUsd"]);
const booleanKeys = new Set(["gvwrDerived", "airConditioner", "refrigerator", "awning"]);
const expandedRvHeaders = ["model_year", "Manufacturer", "brand", "line", "model", "Description", "model_year_label", "body_type", "dry_weight_lb", "gvwr_lb", "gvwr_derived", "cargo_capacity_lb", "hitch_weight_lb", "hitch_weight_basis", "hitch_kind", "length_ft", "width_ft", "exterior_height_ft", "interior_height_ft", "fresh_water_gal", "grey_water_gal", "black_water_gal", "sleeps", "axles", "slides", "tires", "air_conditioner", "refrigerator", "awning", "primary_bed", "layout", "msrp_usd"];
const normalizedHeader = (value: unknown) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const clean = (value: unknown, limit = 500) => String(value ?? "").trim().slice(0, limit);
const additionalKey = (header: string) => header.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_, character: string) => character.toUpperCase()).replace(/^[A-Z]/, (character) => character.toLowerCase()).slice(0, 80);
const recognized = (header: unknown, industry: ProductExtractionIndustry) => commonAliases[normalizedHeader(header)] || (industry === "rv" ? rvAliases[normalizedHeader(header)] : "");
const isHeaderlessExpandedRvRow = (row: unknown[]) => industryValue(row[0]) >= 1900 && industryValue(row[0]) <= 2200 && clean(row[2]) !== "" && clean(row[4]) !== "" && clean(row[7]) !== "" && Number.isFinite(industryValue(row[8])) && Number.isFinite(industryValue(row[9]));
const industryValue = (value: unknown) => Number(String(value ?? "").replace(/[$,]/g, ""));

function typedValue(value: unknown, key: string): SpecificationValue {
  if (value === null || value === undefined || clean(value) === "") return null;
  if (numericKeys.has(key)) { const numeric = typeof value === "number" ? value : Number(clean(value).replace(/[$,]/g, "")); return Number.isFinite(numeric) ? numeric : clean(value); }
  if (booleanKeys.has(key)) { if (typeof value === "boolean") return value; const normalized = clean(value).toLowerCase(); if (["true", "yes", "y", "1"].includes(normalized)) return true; if (["false", "no", "n", "0"].includes(normalized)) return false; }
  return clean(value);
}

export async function parseTemplateProductSpreadsheet(file: File, industry: ProductExtractionIndustry): Promise<SpreadsheetImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const products: SpreadsheetProduct[] = []; const errors: string[] = []; let totalRows = 0; let expanded = false;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
    if (!matrix.some((row) => row.some((value) => clean(value)))) continue;
    const sheetStartRow = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]).s.r + 1 : 1;
    const headerMatch = matrix.slice(0, 25).map((row, index) => ({ index, score: row.filter((cell) => recognized(cell, industry)).length })).sort((left, right) => right.score - left.score || left.index - right.index)[0];
    const headerlessRv = industry === "rv" && (!headerMatch || headerMatch.score < 2) && matrix.length > 0 && isHeaderlessExpandedRvRow(matrix[0]);
    if ((!headerMatch || headerMatch.score < 2) && !headerlessRv) { errors.push(`${sheetName}: no recognizable product header row was found.`); continue; }
    const headerIndex = headerlessRv ? -1 : headerMatch.index;
    const headers = headerlessRv ? expandedRvHeaders : matrix[headerIndex].map((cell) => clean(cell, 120));
    if (headerlessRv) errors.push(`${sheetName}: the header row was missing; recognized the expanded RV column order and imported the data rows.`);
    if (headers.some((header) => ["model_year", "body_type", "dry_weight_lb", "msrp_usd"].includes(header.trim().toLowerCase()))) expanded = true;
    for (let rowIndex = headerIndex + 1; rowIndex < matrix.length; rowIndex++) {
      const row = matrix[rowIndex]; if (!row.some((value) => clean(value))) continue;
      totalRows++; if (totalRows > 500) throw new Error("A spreadsheet can contain up to 500 populated product rows per import.");
      const values: Record<string, unknown> = {}; const specifications: Record<string, SpecificationValue> = {}; const warnings: string[] = [];
      headers.forEach((header, columnIndex) => {
        if (!header) return; const mapped = recognized(header, industry); const value = row[columnIndex];
        if (mapped && Object.values(commonAliases).includes(mapped)) values[mapped] = value;
        else { const key = mapped || additionalKey(header); if (key) specifications[key] = typedValue(value, key); if (!mapped) warnings.push(`Preserved unmapped column: ${header}`); }
      });
      const model = clean(values.model, 160); const yearValue = Number.parseInt(clean(values.modelYear), 10); const modelYear = Number.isInteger(yearValue) && yearValue >= 1900 && yearValue <= 2200 ? yearValue : null;
      if (industry === "rv" && clean(values.category)) specifications.rvType = clean(values.category, 120);
      const brand = clean(specifications.brand, 160); const line = clean(specifications.productLine, 160); const suppliedName = clean(values.name, 180);
      const name = suppliedName || [modelYear, brand || clean(values.manufacturer, 160), line, model].filter(Boolean).join(" ") || model;
      const sourceRow = sheetStartRow + rowIndex;
      if (!name) { errors.push(`${sheetName} row ${sourceRow}: Product Name/Model could not be identified.`); continue; }
      products.push({ name, model: model || name, manufacturer: clean(values.manufacturer || brand, 160), modelYear, modelVariant: line, category: clean(values.category, 120), description: clean(values.description, 4_000), specifications, warnings: Array.from(new Set(warnings)), sourceRow });
    }
  }
  if (!products.length && !errors.length) throw new Error("No products were found. Include a Product Name or Model column and at least one completed row.");
  return { products, totalRows, errors, detectedFormat: expanded ? "expanded" : "runfloor" };
}
