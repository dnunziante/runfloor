import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { extractCustomerTextTemplates } from "@/lib/rag/openai";
import { flagTemplateDuplicates, parseTemplateSpreadsheet, readTemplateDocument, type ImportedTextTemplate } from "@/lib/sales/text-template-import";

async function context() {
  const viewer = await getViewer();
  if (!viewer?.organizationId || viewer.demo || !["tenant_admin", "platform_owner"].includes(viewer.role)) return null;
  return { viewer, supabase: await createClient() };
}

export async function POST(request: Request) {
  const current = await context();
  if (!current) return NextResponse.json({ error: "Tenant administrator access is required." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const mode = form.get("mode") === "document" ? "document" : "spreadsheet";
  const contentType = form.get("contentType") === "sales_script" ? "sales_script" : form.get("contentType") === "objection_response" ? "objection_response" : form.get("contentType") === "email_template" ? "email_template" : "text_template";
  if (!(file instanceof File) || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Choose a file smaller than 10 MB." }, { status: 400 });
  const allowed = mode === "spreadsheet" ? /\.(xlsx|csv)$/i : /\.(pdf|docx|txt)$/i;
  if (!allowed.test(file.name)) return NextResponse.json({ error: mode === "spreadsheet" ? "Upload an Excel or CSV file." : "Upload a PDF, DOCX, or TXT file." }, { status: 400 });
  try {
    const sourceText = mode === "document" ? await readTemplateDocument(file) : "";
    const templates = mode === "document" ? (await extractCustomerTextTemplates(file.name, sourceText, contentType === "email_template" ? "email" : "text")).map((item) => ({ ...item, objection: "", validationIssues: [] as string[] })) : await parseTemplateSpreadsheet(file);
    if (contentType === "objection_response") for (const item of templates) if (item.objection.length < 2) item.validationIssues.push("Customer objection is required");
    if (!templates.length) return NextResponse.json({ error: "No templates were detected in this file." }, { status: 422 });
    const { data } = await current.supabase.from("sales_content_items").select("id,title,objection,body").eq("organization_id", current.viewer.organizationId).eq("content_type", contentType);
    const contentGroup = contentType === "sales_script" ? "sales_script" : contentType === "objection_response" ? "objection_response" : "message_template";
    const { data: categoryRows } = await current.supabase.from("text_template_categories").select("name").eq("organization_id", current.viewer.organizationId).eq("content_group", contentGroup);
    const known = new Set((categoryRows || []).map((item) => item.name.trim().toLowerCase()));
    const missingCategories = [...new Set(templates.map((item) => item.category.trim()).filter((name) => name && !known.has(name.toLowerCase())))];
    return NextResponse.json({ sourceText, templates: flagTemplateDuplicates(templates, data || []), missingCategories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The file could not be processed.";
    return NextResponse.json({ error: message.includes("OpenAI") ? message : "The file could not be processed. Check its contents and try again." }, { status: 422 });
  }
}

type ImportRequest = { templates?: ImportedTextTemplate[]; duplicateStrategy?: "skip" | "replace" | "new"; contentType?: "sales_script" | "objection_response" | "text_template" | "email_template"; createMissingCategories?: boolean; categoryMappings?: Record<string, string> };
export async function PUT(request: Request) {
  const current = await context();
  if (!current) return NextResponse.json({ error: "Tenant administrator access is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as ImportRequest | null;
  const contentType = body?.contentType === "sales_script" ? "sales_script" : body?.contentType === "objection_response" ? "objection_response" : body?.contentType === "email_template" ? "email_template" : "text_template";
  const templates = Array.isArray(body?.templates) ? body.templates.slice(0, 500) : [];
  const strategy = body?.duplicateStrategy === "replace" || body?.duplicateStrategy === "new" ? body.duplicateStrategy : "skip";
  const categoryMappings = body?.categoryMappings && typeof body.categoryMappings === "object" ? body.categoryMappings : {};
  let imported = 0, replaced = 0, skipped = 0, drafts = 0;
  if (body?.createMissingCategories) {
    const names = [...new Set(templates.map((item) => String(categoryMappings[item.category] || item.category || "").trim()).filter(Boolean))];
    const contentGroup = contentType === "sales_script" ? "sales_script" : contentType === "objection_response" ? "objection_response" : "message_template";
    for (const [index, name] of names.entries()) await current.supabase.from("text_template_categories").upsert({ organization_id: current.viewer.organizationId, content_group: contentGroup, name: name.slice(0, 120), position: 500 + index * 10 }, { onConflict: "organization_id,content_group,name" });
  }
  for (const item of templates) {
    const title = String(item.title || "").trim().slice(0, 160), content = String(item.content || "").trim().slice(0, 12000);
    const objection = String(item.objection || "").trim().slice(0, 4000);
    if (title.length < 2 || content.length < 2 || (contentType === "objection_response" && objection.length < 2) || !String(item.category || "").trim() || (item.validationIssues || []).length) { skipped++; continue; }
    const status = item.status === "published" || item.status === "archived" ? item.status : "draft";
    const record = { organization_id: current.viewer.organizationId, content_type: contentType, title, objection: contentType === "objection_response" ? objection : "", body: content, category: String(categoryMappings[item.category] || item.category || "").trim().slice(0, 120), tags: Array.isArray(item.tags) ? item.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 20) : [], status, created_by: current.viewer.id, updated_at: new Date().toISOString() };
    if (item.duplicateId && strategy === "skip") { skipped++; continue; }
    const result = item.duplicateId && strategy === "replace" ? await current.supabase.from("sales_content_items").update(record).eq("id", item.duplicateId).eq("organization_id", current.viewer.organizationId).eq("content_type", contentType) : await current.supabase.from("sales_content_items").insert(record);
    if (result.error) { skipped++; continue; }
    if (item.duplicateId && strategy === "replace") replaced++; else imported++;
    if (status === "draft") drafts++;
  }
  return NextResponse.json({ imported, replaced, skipped, drafts });
}
