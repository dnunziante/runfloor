import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEmbeddings, EMBEDDING_MODEL } from "@/lib/rag/openai";
import { extractDocumentPages, makeKnowledgeChunks } from "@/lib/rag/chunking";

function vector(values: number[]) { return `[${values.join(",")}]`; }
function publicError(error: unknown) { return error instanceof Error ? error.message.slice(0, 500) : "AI indexing could not be completed."; }

export async function processKnowledgeDocument(input: { documentId: string; organizationId: string; locationId: string | null; productId: string | null; sourceName: string; file: File }) {
  const admin = createAdminClient();
  const access=await admin.rpc("solo_document_processing_access",{target_org:input.organizationId});
  if(access.error || access.data!==true)return {indexed:false,error:"Document processing is unavailable for this account."};
  let chunkCount = 0;
  await admin.from("knowledge_documents").update({ status: "processing", processing_error: null }).eq("id", input.documentId).eq("organization_id", input.organizationId);
  try {
    const chunks = makeKnowledgeChunks(await extractDocumentPages(input.file));
    chunkCount = chunks.length;
    const embeddings: number[][] = [];
    for (let index = 0; index < chunks.length; index += 32) embeddings.push(...await createEmbeddings(chunks.slice(index, index + 32).map((chunk) => chunk.content)));
    const { error: deleteError } = await admin.from("knowledge_document_chunks").delete().eq("document_id", input.documentId).eq("organization_id", input.organizationId);
    if (deleteError) throw deleteError;
    const { error: insertError } = await admin.from("knowledge_document_chunks").insert(chunks.map((chunk, chunkIndex) => ({
      organization_id: input.organizationId, document_id: input.documentId, chunk_index: chunkIndex, content: chunk.content,
      location_id: input.locationId, product_id: input.productId, page_number: chunk.pageNumber, section: chunk.section,
      source_name: input.sourceName,
      metadata: { page_number: chunk.pageNumber, section: chunk.section, location_id: input.locationId, product_id: input.productId },
      embedding: vector(embeddings[chunkIndex]), embedding_model: EMBEDDING_MODEL,
    })));
    if (insertError) throw insertError;
    const { error: readyError } = await admin.from("knowledge_documents").update({ status: "ready", processed_at: new Date().toISOString(), processing_error: null }).eq("id", input.documentId).eq("organization_id", input.organizationId);
    if (readyError) throw readyError;
  } catch (error) {
    const message = publicError(error);
    await admin.from("knowledge_documents").update({ status: "failed", processing_error: message }).eq("id", input.documentId).eq("organization_id", input.organizationId);
    return { indexed: false, error: message };
  }
  return { indexed: true as const, chunkCount };
}
