/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { golfCartBulkAliases, golfCartBulkFields } from "@/lib/products/golf-cart-bulk-fields";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

const columns = ["Product Type","Brand","Model Year","Model Name","Model Variant","Category","Passenger Capacity","MSRP","Sale Price","Battery Type","Battery Voltage","Battery Capacity","Motor","Controller","Horsepower","Top Speed","Estimated Range","Charging Time","Dimensions","Overall Length","Overall Width","Overall Height","Wheelbase","Ground Clearance","Turning Radius","Maximum Load Capacity","Tire Size","Wheel Size","Brakes","Suspension","Steering","Frame Material","Display","Audio System","Lighting","Seat Material","Safety Features","Warranty","Standard Features","Optional Features","Colors","Notes","Product URL","Image URL"] as const;
const fieldMap: Record<string,string> = { ...Object.fromEntries(columns.map(c => [c.toLowerCase(), c])), ...golfCartBulkAliases, power: "Power", "body material": "Body Material" };
const specKeys: Record<string,string> = {"Power":"power","Body Material":"bodyMaterial","Battery Type":"batteryType","Battery Voltage":"batteryVoltage","Battery Capacity":"batteryCapacity","Motor":"motor","Controller":"controller","Horsepower":"horsepower","Top Speed":"topSpeed","Charging Time":"chargingTime","Overall Length":"overallLength","Overall Width":"overallWidth","Overall Height":"overallHeight","Wheelbase":"wheelbase","Ground Clearance":"groundClearance","Tire Size":"tireSize","Wheel Size":"wheelSize","Brakes":"brakes","Suspension":"suspension","Steering":"steering","Frame Material":"frameMaterial","Display":"display","Audio System":"audioSystem","Lighting":"lighting","Seat Material":"seatMaterial","Safety Features":"safetyFeatures","Warranty":"warranty","Standard Features":"standardFeatures","Optional Features":"optionalFeatures","Colors":"colors","Notes":"notes","Product URL":"productUrl","Image URL":"imageUrl"};
type Parsed = Record<string, string> & { row: string; status: string; existingId?: string };
const string = (value: unknown) => String(value ?? "").trim();
const type = (value: string) => value.toLowerCase().replace(/\s+/g,"_") === "competitor_product" || value.toLowerCase() === "competitor product" ? "competitor_product" : value.toLowerCase().replace(/\s+/g,"_") === "our_product" || value.toLowerCase() === "our product" ? "our_product" : "";

async function parse(file: File): Promise<Parsed[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return records.map((record, index) => {
    const row: Parsed = { row: String(index + 2), status: "Ready" };
    for (const [key, value] of Object.entries(record)) {
      const header = key.trim().toLowerCase();
      if (!Object.hasOwn(fieldMap, header)) continue;
      const field = fieldMap[header];
      const text = string(value);
      if (text && (header === field.toLowerCase() || !row[field])) row[field] = text;
    }
    if (!type(row["Product Type"] || "")) row.status = "Invalid Product Type";
    else if (!row.Brand) row.status = "Missing Manufacturer / Brand";
    else if (!row["Model Name"]) row.status = "Missing Model / Model Name";
    else if (!/^\d{4}$/.test(row["Model Year"] || "")) row.status = "Missing or invalid Model Year";
    else if (row.MSRP && !Number.isFinite(Number(row.MSRP.replace(/[$,]/g, "")))) row.status = "Invalid MSRP";
    return row;
  });
}

async function viewer() { const value = await getViewer(); if (!value?.organizationId || value.demo || !["tenant_admin","platform_owner"].includes(value.role)) return null; return value; }
function sampleRows() { return [{"Product Type":"Our Product","Brand":"Bintelli","Model Year":2027,"Model Name":"Nexus","Model Variant":"Lifted 6 Passenger","Category":"Golf Cart / LSV","Passenger Capacity":"6","MSRP":"15995","Battery Type":"Lithium","Battery Voltage":"72V","Motor":"AC","Estimated Range":"Up to 55 mi","Standard Features":"Power steering; 10.1-inch touchscreen"},{"Product Type":"Competitor Product","Brand":"Evolution","Model Year":2027,"Model Name":"D5 Ranger","Model Variant":"6","Category":"Golf Cart / LSV","Passenger Capacity":"6","Battery Type":"Lithium","Battery Voltage":"48V"}]; }

function golfCartTemplate(format: "csv" | "xlsx", competitorOnly: boolean) {
  const workbook = XLSX.utils.book_new();
  const products = XLSX.utils.aoa_to_sheet([golfCartBulkFields.map(({ label }) => label)]);
  products["!cols"] = [{ wch: 23 }, { wch: 13 }, { wch: 25 }, { wch: 29 }, { wch: 13 }, { wch: 13 }, { wch: 20 }, { wch: 31 }, { wch: 29 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(workbook, products, "Products");
  if (format === "xlsx") {
    const instructions = XLSX.utils.aoa_to_sheet([
      ["Required fields", "Product Type, Model Year, Manufacturer, Model"],
      ["Product Type", competitorOnly ? "Competitor Product" : "Our Product or Competitor Product"],
      ["Model Year", "Use a four-digit year."],
      ["Models and variants", "Use one row per model or variant. Include the variant in Model when applicable."],
      ["Length and Width", "Include units, for example 94.5 in."],
      ["Features", "Separate features with semicolons."],
    ]);
    instructions["!cols"] = [{ wch: 22 }, { wch: 87 }];
    XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
  }
  return new NextResponse(XLSX.write(workbook, { type: "buffer", bookType: format }), {
    headers: {
      "content-type": format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename=RunFloor_Golf_Cart_Bulk_Upload_Template.${format}`,
    },
  });
}

export async function GET(request: Request) { const params = new URL(request.url).searchParams; const format = params.get("format") === "csv" ? "csv" : "xlsx"; if (params.get("template") === "golf-cart") return golfCartTemplate(format, params.get("competitorOnly") === "true"); const wb = XLSX.utils.book_new(); const products = XLSX.utils.json_to_sheet(new URL(request.url).searchParams.get("competitorOnly") === "true" ? sampleRows().filter(row => row["Product Type"] === "Competitor Product") : sampleRows(), { header: [...columns] }); XLSX.utils.book_append_sheet(wb, products, "Products"); const instructions = XLSX.utils.aoa_to_sheet([["RunFloor Product Bulk Upload"],["Required fields","Product Type, Brand, Model Year, Model Name"],["Product Type values","Our Product or Competitor Product"],["Model year","Use a four-digit year. Years remain separate records."],["Duplicate handling","Preview flags duplicates. Skip is the safest default; update changes the matching tenant product."],["Features","Use semicolons to separate standard or optional features."]]); XLSX.utils.book_append_sheet(wb, instructions, "Instructions"); const output = XLSX.write(wb, { type: "buffer", bookType: format }); return new NextResponse(output, { headers: { "content-type": format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename=RunFloor_Product_Bulk_Upload_Template.${format}` } }); }

export async function POST(request: Request) { const current = await viewer(); if (!current) return NextResponse.json({ error: "Tenant administrator access is required." }, { status: 403 }); const form = await request.formData(); const file = form.get("file"); if (!(file instanceof File) || !/\.(xlsx|csv)$/i.test(file.name)) return NextResponse.json({ error: "Upload a CSV or Excel .xlsx file." }, { status: 400 }); const rows = await parse(file); if (form.get("competitorOnly") === "true") rows.forEach(row => { if (type(row["Product Type"] || "") !== "competitor_product") row.status = "Competitor Product required"; }); const supabase = await createClient(); const { data: existing } = await supabase.from("products").select("id,brand,model_year,name,model_variant,product_type").eq("organization_id", current.organizationId); const index = new Map((existing || []).map((p: any) => [`${p.brand}|${p.model_year}|${p.name}|${p.model_variant}|${p.product_type}`, p.id])); rows.forEach(row => { const id = index.get(`${row.Brand}|${row["Model Year"]}|${row["Model Name"]}|${row["Model Variant"] || ""}|${type(row["Product Type"] || "")}`); if (row.status === "Ready" && id) { row.status = "Possible Duplicate"; row.existingId = id; } }); if (form.get("mode") !== "import") return NextResponse.json({ rows, summary: { total: rows.length, valid: rows.filter(r => r.status === "Ready").length, invalid: rows.filter(r => r.status !== "Ready" && r.status !== "Possible Duplicate").length, duplicates: rows.filter(r => r.status === "Possible Duplicate").length, ours: rows.filter(r => type(r["Product Type"] || "") === "our_product").length, competitors: rows.filter(r => type(r["Product Type"] || "") === "competitor_product").length } }); const strategy = form.get("duplicateStrategy") === "update" ? "update" : "skip"; let imported = 0, updated = 0, skipped = 0; const failed: Array<{row:string;reason:string}> = []; for (const row of rows) { if (row.status !== "Ready" && !(row.status === "Possible Duplicate" && strategy === "update")) { skipped++; continue; } const specs = Object.fromEntries(Object.entries(specKeys).map(([label,key]) => [key, row[label] || ""]).filter(([,v]) => v)); const values = { organization_id: current.organizationId, name: row["Model Name"], slug: `${row.Brand}-${row["Model Year"]}-${row["Model Name"]}-${row["Model Variant"] || "standard"}`.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""), model: row["Model Variant"] || "", brand: row.Brand, manufacturer: row.Brand, model_year: Number(row["Model Year"]), model_variant: row["Model Variant"] || "", product_type: type(row["Product Type"]), product_category: row.Category || "", seats_text: row["Passenger Capacity"] || "", base_price_cents: Math.round(Number((row.MSRP || "0").replace(/[$,]/g,""))*100), sale_price_cents: row["Sale Price"] ? Math.round(Number(row["Sale Price"].replace(/[$,]/g,""))*100) : null, range_text: row["Estimated Range"] || "", dimensions: row.Dimensions || "", turning_radius: row["Turning Radius"] || "", max_load_capacity: row["Maximum Load Capacity"] || "", powertrain_text: row.Power || row["Battery Voltage"] || "", highlights: (row["Standard Features"] || "").split(";").map(x=>x.trim()).filter(Boolean), specifications: specs, status: "published", source_name: "Bulk upload", import_file_name: file.name, imported_by: current.id, imported_at: new Date().toISOString() }; const result = row.existingId && strategy === "update" ? await supabase.from("products").update(values).eq("id", row.existingId).eq("organization_id", current.organizationId) : await supabase.from("products").insert(values); if (result.error) failed.push({ row: row.row, reason: "Could not save product" }); else if (row.existingId) updated++; else imported++; } return NextResponse.json({ imported, updated, skipped, failed }); }
/* eslint-disable @typescript-eslint/no-explicit-any */
