import "server-only";

import { getViewer } from "@/lib/auth/viewer";
import { demoKnowledgeDocuments, publicRvDemoKnowledgeDocuments } from "@/lib/demo/training";
import { isLocalDemoMode } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { KnowledgeDocumentDTO, KnowledgeResult } from "./types";

type KnowledgeRow = {
  id: string;
  title: string;
  original_filename: string;
  collection: string;
  mime_type: string;
  size_bytes: number;
  status: "uploaded" | "processing" | "ready" | "failed" | "error";
  created_at: string;
};

const statusLabels = {
  uploaded: "Uploaded",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
  error: "Error",
} as const;

export async function getKnowledgeDocuments(): Promise<KnowledgeResult> {
  const viewer = await getViewer();
  if (viewer?.demo || isLocalDemoMode()) return { documents: viewer?.demo && !isLocalDemoMode() ? publicRvDemoKnowledgeDocuments : demoKnowledgeDocuments };
  if (!viewer?.organizationId) return { documents: [], error: "Your account is not assigned to an organization." };

  const supabase = await createClient();
  const [{ data, error }, { data: lessonRows, error: lessonError }, { data: chunkRows, error: chunkError }] = await Promise.all([
    supabase
      .from("knowledge_documents")
      .select("id, title, original_filename, collection, mime_type, size_bytes, status, created_at")
      .eq("organization_id", viewer.organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_lessons")
      .select("id, knowledge_document_id, generation_status, is_published, source_review_required")
      .eq("organization_id", viewer.organizationId),
    supabase
      .from("knowledge_document_chunks")
      .select("document_id")
      .eq("organization_id", viewer.organizationId),
  ]);

  if (error || lessonError || chunkError) return { documents: [], error: "Knowledge documents could not be loaded." };

  const lessonByDocument = new Map((lessonRows ?? []).map((lesson) => [lesson.knowledge_document_id as string, lesson]));
  const chunksByDocument = new Map<string, number>();
  for (const chunk of chunkRows ?? []) chunksByDocument.set(chunk.document_id as string, (chunksByDocument.get(chunk.document_id as string) ?? 0) + 1);

  return {
    documents: (data as KnowledgeRow[]).map((row): KnowledgeDocumentDTO => ({
      id: row.id,
      title: row.title,
      filename: row.original_filename,
      collection: row.collection,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      status: statusLabels[row.status],
      createdAt: row.created_at,
      chunkCount: chunksByDocument.get(row.id) ?? 0,
      trainingLessonId: lessonByDocument.get(row.id)?.id as string | undefined,
      trainingLessonStatus: lessonByDocument.get(row.id)?.generation_status as KnowledgeDocumentDTO["trainingLessonStatus"],
      trainingLessonPublished: lessonByDocument.get(row.id)?.is_published as boolean | undefined,
      trainingSourceReviewRequired: lessonByDocument.get(row.id)?.source_review_required as boolean | undefined,
    })),
  };
}
