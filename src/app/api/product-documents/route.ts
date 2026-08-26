import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractProductModels } from "@/lib/products/document-extraction";

const types = new Set(["image/jpeg", "image/png", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"]);
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.organizationId || !["tenant_admin", "platform_owner", "manager"].includes(viewer.role)) return NextResponse.json({ error: "Manager access is required." }, { status: 403 });
  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  const productType = form.get("productType") === "competitor_product" ? "competitor_product" : "our_product";
  const manufacturer = String(form.get("manufacturer") || "").trim().slice(0, 160);
  const returnTo = String(form.get("returnTo") || "/admin/products");
  if (!files.length) return NextResponse.json({ error: "Choose at least one file." }, { status: 400 });
  const db = createAdminClient();
  const { data: organization } = await db.from("organizations").select("industry_template_id").eq("id", viewer.organizationId).maybeSingle();
  const { data: template } = organization?.industry_template_id ? await db.from("industry_templates").select("template_key").eq("id", organization.industry_template_id).maybeSingle() : { data: null };
  const industry = template?.template_key === "golf-cart" ? "golf-cart" as const : template?.template_key === "rv" ? "rv" as const : "generic" as const;
  for (const file of files) {
    if (!types.has(file.type) || file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Files must be JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, or CSV and no larger than 20 MB." }, { status: 400 });
    const path = `${viewer.organizationId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    if ((await db.storage.from("product-documents").upload(path, file, { contentType: file.type })).error) return NextResponse.json({ error: "A file could not be uploaded." }, { status: 500 });
    const { data: document, error } = await db.from("product_documents").insert({ organization_id: viewer.organizationId, uploaded_by: viewer.id, title: file.name.replace(/\.[^.]+$/, ""), original_filename: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size, initial_product_type: productType, manufacturer, processing_status: "processing" }).select("id").single();
    if (error || !document) return NextResponse.json({ error: "A document record could not be saved." }, { status: 500 });
    try {
      const models = await extractProductModels(file, {}, industry);
      for (const item of models) {
        const brand = item.manufacturer || manufacturer;
        await db.from("products").insert({ organization_id: viewer.organizationId, source_document_id: document.id, product_type: productType, review_status: "pending_review", status: "draft", name: item.name, slug: `${slug(item.name)}-${crypto.randomUUID().slice(0, 8)}`, model: item.model, manufacturer: brand, brand, model_year: item.modelYear, product_category: item.category, description: item.description, specifications: item.specifications, base_price_cents: 0, visual_theme: "blue" });
      }
      await db.from("product_documents").update({ processing_status: "needs_review", models_found: models.length, updated_at: new Date().toISOString() }).eq("id", document.id);
    } catch (error) {
      await db.from("product_documents").update({ processing_status: "needs_review", processing_error: error instanceof Error ? error.message : "Extraction needs review", updated_at: new Date().toISOString() }).eq("id", document.id);
    }
  }
  return NextResponse.redirect(new URL(returnTo.startsWith("/admin/") ? returnTo : "/admin/products", request.url), 303);
}
