import { ENABLE_SALES_COACHING } from "@/lib/features";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { isKnowledgeCollection } from "@/lib/knowledge/collections";
import { processKnowledgeDocument } from "@/lib/rag/process-document";
import { generateTrainingLessonForDocument, parseTrainingGenerationOptions } from "@/lib/training/generate";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function safeFilename(filename: string) {
  const extension = filename.includes(".") ? `.${filename.split(".").pop()?.toLowerCase()}` : "";
  const base = filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "document";
  return `${base}${extension}`;
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || !viewer.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (viewer.demo) return NextResponse.json({ error: "Uploads are disabled in local demo mode." }, { status: 403 });
  if (!["tenant_admin", "platform_owner"].includes(viewer.role)) return NextResponse.json({ error: "Tenant administrator access is required." }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  const title = String(formData.get("title") || "").trim();
  const requestedCollection = String(formData.get("collection") || "General");
  const collection = isKnowledgeCollection(requestedCollection) ? requestedCollection : "General";
  const contextType = formData.get("contextType") === "communication_example" ? "communication_example" : "knowledge";
  const addToTraining = ENABLE_SALES_COACHING && formData.get("addToTraining") === "on";
  const trainingOptions = parseTrainingGenerationOptions({
    estimatedMinutes: formData.get("lessonLength"),
    trainingType: formData.get("trainingType"),
    includeKnowledgeCheck: formData.get("includeKnowledgeCheck"),
  });
  const locationId = String(formData.get("locationId") || "").trim() || null;
  const productId = String(formData.get("productId") || "").trim() || null;

  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a document to upload." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Upload a PDF, Word document, Markdown file, or plain-text file." }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "The document must be 4 MB or smaller." }, { status: 400 });
  if (title.length < 2 || title.length > 140) return NextResponse.json({ error: "Enter a title between 2 and 140 characters." }, { status: 400 });

  const supabase = createAdminClient();
  if (locationId) {
    const { data } = await supabase.from("locations").select("id").eq("id", locationId).eq("organization_id", viewer.organizationId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Choose a location from this organization." }, { status: 400 });
  }
  if (productId) {
    const { data } = await supabase.from("products").select("id").eq("id", productId).eq("organization_id", viewer.organizationId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Choose a product from this organization." }, { status: 400 });
  }
  const storagePath = `${viewer.organizationId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage.from("knowledge-documents").upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "The file could not be uploaded." }, { status: 500 });

  const { data: document, error: metadataError } = await supabase
    .from("knowledge_documents")
    .insert({
      organization_id: viewer.organizationId,
      uploaded_by: viewer.id,
      title,
      original_filename: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      collection,
      context_type: contextType,
      status: "processing",
      location_id: locationId,
      product_id: productId,
    })
    .select("id")
    .single();

  if (metadataError) {
    await supabase.storage.from("knowledge-documents").remove([storagePath]);
    return NextResponse.json({ error: "The document record could not be saved." }, { status: 500 });
  }

  const processing = await processKnowledgeDocument({ documentId: document.id, organizationId: viewer.organizationId, locationId, productId, sourceName: file.name, file });
  if (!processing.indexed) {
    return NextResponse.json({
      success: true,
      documentId: document.id,
      addedToTraining: false,
      failedStep: "indexing",
      ...processing,
    }, { status: 202 });
  }

  if (!addToTraining) {
    return NextResponse.json({ success: true, documentId: document.id, addedToTraining: false, ...processing }, { status: 201 });
  }

  const generation = await generateTrainingLessonForDocument({
    documentId: document.id,
    organizationId: viewer.organizationId,
    createdBy: viewer.id,
    options: trainingOptions,
  });
  if (!generation.ok) {
    return NextResponse.json({
      success: true,
      documentId: document.id,
      addedToTraining: false,
      indexed: true,
      chunkCount: processing.chunkCount,
      failedStep: generation.step,
      lessonId: generation.lessonId,
      error: generation.error,
    }, { status: 202 });
  }

  return NextResponse.json({
    success: true,
    documentId: document.id,
    addedToTraining: true,
    indexed: true,
    chunkCount: processing.chunkCount,
    lessonId: generation.lessonId,
    reviewUrl: `/training/${generation.lessonId}/review`,
  }, { status: 201 });
}
