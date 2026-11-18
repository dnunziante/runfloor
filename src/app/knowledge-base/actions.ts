"use server";
import { isFreeSolo } from "@/lib/plans/policy";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isKnowledgeCollection } from "@/lib/knowledge/collections";
import { processKnowledgeDocument } from "@/lib/rag/process-document";

export type KnowledgeCollectionUpdateResult = { error: string; success: string };

export async function reindexKnowledgeDocument(documentId: string): Promise<KnowledgeCollectionUpdateResult> {
  const viewer = await getViewer();
  if (isFreeSolo(viewer?.plan) && viewer?.role !== "platform_owner") throw new Error("Upgrade to Sales Solo to edit inventory, documents or templates.");
  if (!viewer?.organizationId || !["tenant_admin", "platform_owner"].includes(viewer.role)) return { error: "Administrator access is required.", success: "" };
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return { error: "Choose a valid document.", success: "" };

  const admin = createAdminClient();
  const { data: document, error: lookupError } = await admin
    .from("knowledge_documents")
    .select("id, organization_id, original_filename, storage_path, mime_type, location_id, product_id")
    .eq("id", documentId)
    .eq("organization_id", viewer.organizationId)
    .maybeSingle();
  if (lookupError || !document) return { error: "Document not found in this workspace.", success: "" };

  const { data: storedFile, error: downloadError } = await admin.storage.from("knowledge-documents").download(document.storage_path);
  if (downloadError || !storedFile) return { error: "The private source file could not be downloaded for indexing.", success: "" };

  const result = await processKnowledgeDocument({
    documentId: document.id,
    organizationId: document.organization_id,
    locationId: document.location_id,
    productId: document.product_id,
    sourceName: document.original_filename,
    file: new File([storedFile], document.original_filename, { type: document.mime_type }),
  });
  revalidatePath("/knowledge-base");
  if (!result.indexed) return { error: result.error, success: "" };
  return { error: "", success: "The document was indexed successfully." };
}

export async function updateKnowledgeDocumentCollection(documentId: string, collection: string): Promise<KnowledgeCollectionUpdateResult> {
  const viewer = await getViewer();
  if (isFreeSolo(viewer?.plan) && viewer?.role !== "platform_owner") throw new Error("Upgrade to Sales Solo to edit inventory, documents or templates.");
  if (!viewer?.organizationId || !["tenant_admin", "platform_owner"].includes(viewer.role)) return { error: "Administrator access is required.", success: "" };
  if (!/^[0-9a-f-]{36}$/i.test(documentId) || !isKnowledgeCollection(collection)) return { error: "Choose a valid collection.", success: "" };

  const supabase = await createClient();
  const { data: document, error } = await supabase
    .from("knowledge_documents")
    .update({ collection })
    .eq("id", documentId)
    .eq("organization_id", viewer.organizationId)
    .select("original_filename")
    .maybeSingle();

  if (error || !document) return { error: "The document collection could not be updated.", success: "" };

  const { error: lessonError } = await supabase
    .from("training_lessons")
    .update({ description: `${collection} training based on ${document.original_filename}`, updated_at: new Date().toISOString() })
    .eq("knowledge_document_id", documentId)
    .eq("organization_id", viewer.organizationId);

  revalidatePath("/knowledge-base");
  revalidatePath("/training");
  if (lessonError) return { error: "The collection was saved, but the linked lesson description could not be refreshed.", success: "" };
  return { error: "", success: `Moved to ${collection}.` };
}

export async function deleteKnowledgeDocument(formData: FormData) {
  const viewer = await getViewer();
  if (isFreeSolo(viewer?.plan) && viewer?.role !== "platform_owner") throw new Error("Upgrade to Sales Solo to edit inventory, documents or templates.");
  if (!viewer?.organizationId || !["tenant_admin", "platform_owner"].includes(viewer.role)) throw new Error("Unauthorized");

  const documentId = String(formData.get("documentId") || "");
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) throw new Error("Invalid document ID");

  const supabase = await createClient();
  const { data: document, error: lookupError } = await supabase
    .from("knowledge_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("organization_id", viewer.organizationId)
    .maybeSingle();

  if (lookupError || !document) throw new Error("Document not found");

  const { error: storageError } = await supabase.storage.from("knowledge-documents").remove([document.storage_path]);
  if (storageError) throw new Error("The stored file could not be removed.");

  const { error: metadataError } = await supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", documentId)
    .eq("organization_id", viewer.organizationId);

  if (metadataError) throw new Error("The document record could not be removed.");
  revalidatePath("/knowledge-base");
  revalidatePath("/training");
}
