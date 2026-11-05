import { ENABLE_SALES_COACHING } from "@/lib/features";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { processKnowledgeDocument } from "@/lib/rag/process-document";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTrainingLessonForDocument, parseTrainingGenerationOptions } from "@/lib/training/generate";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!ENABLE_SALES_COACHING) return NextResponse.json({ error: "Sales Coaching is temporarily unavailable." }, { status: 403 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });

  const viewer = await getViewer();
  if (!viewer?.organizationId || viewer.demo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["tenant_admin", "platform_owner"].includes(viewer.role)) {
    return NextResponse.json({ error: "Tenant administrator access is required." }, { status: 403 });
  }

  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const options = parseTrainingGenerationOptions({
    estimatedMinutes: payload.estimatedMinutes,
    trainingType: payload.trainingType,
    includeKnowledgeCheck: payload.includeKnowledgeCheck,
  });
  const admin = createAdminClient();
  const { data: document, error: documentError } = await admin
    .from("knowledge_documents")
    .select("id, organization_id, original_filename, storage_path, mime_type, status, location_id, product_id")
    .eq("id", id)
    .eq("organization_id", viewer.organizationId)
    .maybeSingle();
  if (documentError || !document) return NextResponse.json({ error: "Document not found in this workspace." }, { status: 404 });

  if (document.status !== "ready") {
    const { data: storedFile, error: downloadError } = await admin.storage.from("knowledge-documents").download(document.storage_path);
    if (downloadError || !storedFile) {
      return NextResponse.json({ failedStep: "indexing", error: "The private source file could not be downloaded for indexing." }, { status: 500 });
    }
    const indexing = await processKnowledgeDocument({
      documentId: document.id,
      organizationId: document.organization_id,
      locationId: document.location_id,
      productId: document.product_id,
      sourceName: document.original_filename,
      file: new File([storedFile], document.original_filename, { type: document.mime_type }),
    });
    if (!indexing.indexed) {
      return NextResponse.json({ failedStep: "indexing", error: indexing.error }, { status: 500 });
    }
  }

  const generation = await generateTrainingLessonForDocument({
    documentId: document.id,
    organizationId: viewer.organizationId,
    createdBy: viewer.id,
    options,
  });
  if (!generation.ok) {
    return NextResponse.json({ failedStep: generation.step, lessonId: generation.lessonId, error: generation.error }, { status: 500 });
  }
  return NextResponse.json({ lessonId: generation.lessonId, reviewUrl: `/training/${generation.lessonId}/review` });
}
