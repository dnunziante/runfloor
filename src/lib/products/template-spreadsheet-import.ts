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
const normalizedHeader = (value: unknown) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const clean = (value: unknown, limit = 500) => String(value ?? "").trim().slice(0, limit);
const additionalKey = (header: string) => header.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_, character: string) => character.toUpperCase()).replace(/^[A-Z]/, (character) => character.toLowerCase()).slice(0, 80);
const recognized = (header: unknown, industry: ProductExtractionIndustry) => commonAliases[normalizedHeader(header)] || (industry === "rv" ? rvAliases[normalizedHeader(header)] : "");

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
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    const headerMatch = matrix.slice(0, 25).map((row, index) => ({ index, score: row.filter((cell) => recognized(cell, industry)).length })).sort((left, right) => right.score - left.score || left.index - right.index)[0];
    if (!headerMatch || headerMatch.score < 2) { errors.push(`${sheetName}: no recognizable product header row was found.`); continue; }
    const headers = matrix[headerMatch.index].map((cell) => clean(cell, 120));
    if (headers.some((header) => ["model_year", "body_type", "dry_weight_lb", "msrp_usd"].includes(header.trim().toLowerCase()))) expanded = true;
    for (let rowIndex = headerMatch.index + 1; rowIndex < matrix.length; rowIndex++) {
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
      if (!name) { errors.push(`${sheetName} row ${rowIndex + 1}: Product Name/Model could not be identified.`); continue; }
      products.push({ name, model: model || name, manufacturer: clean(values.manufacturer || brand, 160), modelYear, modelVariant: line, category: clean(values.category, 120), description: clean(values.description, 4_000), specifications, warnings: Array.from(new Set(warnings)), sourceRow: rowIndex + 1 });
    }
  }
  if (!products.length && !errors.length) throw new Error("No products were found. Include a Product Name or Model column and at least one completed row.");
  return { products, totalRows, errors, detectedFormat: expanded ? "expanded" : "runfloor" };
}
