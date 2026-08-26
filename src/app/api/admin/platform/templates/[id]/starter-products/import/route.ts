import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { extractProductModels, type ProductExtractionIndustry } from "@/lib/products/document-extraction";
import { canonicalGolfCartSpecificationKey } from "@/lib/products/golf-cart-specifications";
import { canonicalRvSpecificationKey } from "@/lib/products/rv-specifications";
import { createAdminClient } from "@/lib/supabase/admin";

const types = new Set(["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"]);
const validId = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
const text = (value: unknown, length = 160) => String(value || "").trim().slice(0, length);
function normalizedSpecifications(source: Record<string, string>, industry: ProductExtractionIndustry) {
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [industry === "golf-cart" ? canonicalGolfCartSpecificationKey(key) : industry === "rv" ? canonicalRvSpecificationKey(key) : key.trim(), text(value, 500)]).filter(([key, value]) => key && value));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const { id: templateId } = await params;
  if (viewer?.role !== "platform_owner" || !validId(templateId)) return NextResponse.json({ error: "Platform administrator access is required." }, { status: 403 });
  const data = await request.formData();
  const mode = text(data.get("mode"));
  const db = createAdminClient();
  const { data: template } = await db.from("industry_templates").select("id,template_key").eq("id", templateId).maybeSingle();
  if (!template) return NextResponse.json({ error: "Industry template not found." }, { status: 404 });
  const industry: ProductExtractionIndustry = template.template_key === "golf-cart" ? "golf-cart" : template.template_key === "rv" ? "rv" : "generic";

  if (mode === "extract") {
    const file = data.get("file");
    if (!(file instanceof File) || !types.has(file.type) || file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Upload a PDF, JPG, JPEG, PNG, DOCX, XLSX, or CSV file up to 20 MB." }, { status: 400 });
    const context = { manufacturer: text(data.get("manufacturer")), model: text(data.get("model")), productType: text(data.get("productType")) };
    const importId = crypto.randomUUID();
    const storagePath = `${templateId}/${importId}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error: uploadError } = await db.storage.from("template-product-imports").upload(storagePath, file, { contentType: file.type });
    if (uploadError) return NextResponse.json({ error: "The source document could not be stored." }, { status: 500 });
    const { error: importError } = await db.from("industry_template_product_imports").insert({ id: importId, industry_template_id: templateId, uploaded_by: viewer.id, original_filename: file.name, storage_path: storagePath, mime_type: file.type, size_bytes: file.size });
    if (importError) return NextResponse.json({ error: "The import record could not be saved." }, { status: 500 });
    try {
      const extracted = await extractProductModels(file, context, industry);
      const { data: existing } = await db.from("industry_template_products").select("id,manufacturer,model,model_year,model_variant").eq("industry_template_id", templateId);
      const candidates = extracted.map((item) => {
        const product = { name: text(item.name, 180), model: text(item.model || item.name, 160), manufacturer: text(item.manufacturer || context.manufacturer), modelYear: item.modelYear, modelVariant: "", productCategory: text(item.category, 120), productType: context.productType === "competitor_product" ? "competitor_product" : "our_product", description: text(item.description, 4000), specifications: normalizedSpecifications(item.specifications, industry) };
        const duplicate = (existing || []).find((row) => (row.manufacturer || "").toLowerCase() === product.manufacturer.toLowerCase() && (row.model || "").toLowerCase() === product.model.toLowerCase() && (row.model_variant || "").toLowerCase() === product.modelVariant.toLowerCase() && row.model_year === product.modelYear);
        return { ...product, duplicateId: duplicate?.id || null };
      });
      return NextResponse.json({ importId, candidates, skippedDuplicates: candidates.filter((candidate) => candidate.duplicateId).length });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Extraction failed." }, { status: 422 });
    }
  }

  if (mode === "approve") {
    const importId = text(data.get("importId"));
    const rawCandidates = text(data.get("candidates"), 200_000);
    if (!validId(importId)) return NextResponse.json({ error: "Invalid import." }, { status: 400 });
    const candidates = JSON.parse(rawCandidates || "[]") as Array<Record<string, unknown>>;
    const { data: source } = await db.from("industry_template_product_imports").select("id").eq("id", importId).eq("industry_template_id", templateId).maybeSingle();
    if (!source || !Array.isArray(candidates)) return NextResponse.json({ error: "The import is unavailable." }, { status: 400 });
    let created = 0; let updated = 0; let skipped = 0;
    for (const candidate of candidates) {
      const name = text(candidate.name, 180); const action = text(candidate.action);
      if (!name || action === "skip") { skipped++; continue; }
      const values = { industry_template_id: templateId, source_import_id: importId, family_name: "Starter Products", name, model: text(candidate.model || name), model_year: Number.isInteger(candidate.modelYear) ? candidate.modelYear : null, model_variant: text(candidate.modelVariant), manufacturer: text(candidate.manufacturer), product_category: text(candidate.productCategory, 120), product_type: candidate.productType === "competitor_product" ? "competitor_product" : "our_product", description: text(candidate.description, 4000), specifications: normalizedSpecifications((candidate.specifications || {}) as Record<string, string>, industry), updated_at: new Date().toISOString() };
      if (action === "update" && validId(text(candidate.duplicateId))) { const { error } = await db.from("industry_template_products").update(values).eq("id", text(candidate.duplicateId)).eq("industry_template_id", templateId); if (error) return NextResponse.json({ error: "A starter product could not be updated." }, { status: 500 }); updated++; }
      else { const { error } = await db.from("industry_template_products").insert(values); if (error) return NextResponse.json({ error: "A starter product could not be saved." }, { status: 500 }); created++; }
    }
    return NextResponse.json({ created, updated, skipped });
  }
  return NextResponse.json({ error: "Invalid import request." }, { status: 400 });
}
