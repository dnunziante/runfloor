import "server-only";
import { getViewer, type Viewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processKnowledgeDocument } from "@/lib/rag/process-document";
import { isKnowledgeCollection } from "@/lib/knowledge/collections";
import { normalizeSettings, validDomain } from "./policy";
import type { KnowledgeSettings } from "./types";

export function isKnowledgeAdmin(viewer: Viewer | null) { return Boolean(viewer?.organizationId && !viewer.demo && ["tenant_admin", "platform_owner"].includes(viewer.role)); }
export async function knowledgeAdmin() {
  const viewer = await getViewer();
  return isKnowledgeAdmin(viewer) ? viewer : null;
}
export function parseKnowledgeSettings(value: Partial<KnowledgeSettings>): KnowledgeSettings | null {
  if (!value || ![value.sales_mode, value.operations_mode].every((mode) => mode && ["internal_only", "fallback", "verify"].includes(mode)) || typeof value.external_enabled !== "boolean" || !Number.isInteger(value.daily_limit) || value.daily_limit! < 0 || value.daily_limit! > 1000 || !Number.isInteger(value.cache_minutes) || value.cache_minutes! < 1 || value.cache_minutes! > 1440 || !Array.isArray(value.allowed_domains) || value.allowed_domains.length > 30 || !value.allowed_domains.every((domain) => typeof domain === "string" && validDomain(domain))) return null;
  return normalizeSettings(value);
}
export async function saveSettings(viewer: Viewer, value: KnowledgeSettings) {
  const db = await createClient();
  const { error } = await db.from("ai_knowledge_settings").upsert({ ...value, organization_id: viewer.organizationId, updated_at: new Date().toISOString() });
  if (error) throw new Error("Settings could not be saved.");
}
export type GapDraft = { title: string; answer: string; collection: string; scopes: string[]; managementOnly: boolean; approve: boolean };
export function parseGapDraft(value: Partial<GapDraft>): GapDraft | null {
  if (!value || typeof value.title !== "string" || value.title.trim().length < 2 || value.title.length > 140 || typeof value.answer !== "string" || value.answer.trim().length < 10 || value.answer.length > 12000 || typeof value.collection !== "string" || !isKnowledgeCollection(value.collection) || !Array.isArray(value.scopes) || !value.scopes.length || !value.scopes.every((scope) => ["sales", "operations"].includes(scope)) || typeof value.managementOnly !== "boolean" || typeof value.approve !== "boolean") return null;
  return { ...value, title: value.title.trim(), answer: value.answer.trim(), scopes: [...new Set(value.scopes)] } as GapDraft;
}
export async function saveGapDraft(viewer: Viewer, id: string, draft: GapDraft) {
  const db = createAdminClient();
  const { data: gap, error } = await db.from("ai_knowledge_gaps").select("id,status,document_id,approved_at").eq("organization_id", viewer.organizationId).eq("id", id).maybeSingle();
  if (error || !gap) throw new Error("Knowledge gap not found in this dealership.");
  if (gap.status === "resolved") throw new Error("This gap is already resolved.");
  if (gap.status === "indexing" && gap.approved_at && Date.parse(gap.approved_at) < Date.now() - 300000) {
    await db.from("ai_knowledge_gaps").update({ status: "draft" }).eq("id", id).eq("organization_id", viewer.organizationId).eq("status", "indexing").eq("approved_at", gap.approved_at);
  }
  const fields = { draft_title: draft.title, proposed_answer: draft.answer, draft_category: draft.collection, draft_scopes: draft.scopes };
  if (!draft.approve) {
    const { error } = await db.from("ai_knowledge_gaps").update({ ...fields, status: "draft" }).eq("id", id).eq("organization_id", viewer.organizationId).neq("status", "indexing");
    if (error) throw new Error("The draft could not be saved.");
    return { indexed: false, message: "Draft saved. It is not approved knowledge yet." };
  }
  // Atomic claim prevents concurrent approvals from creating duplicate documents.
  const { data: claimed, error: claimError } = await db.from("ai_knowledge_gaps").update({ ...fields, status: "indexing", approved_by: viewer.id, approved_at: new Date().toISOString() }).eq("id", id).eq("organization_id", viewer.organizationId).in("status", ["open", "draft"]).select("id").maybeSingle();
  if (claimError || !claimed) throw new Error("Approval is already in progress. Refresh to check its status.");
  const documentId = gap.document_id || gap.id;
  const filename = `approved-gap-${id}.md`;
  const storagePath = `${viewer.organizationId}/${documentId}-${filename}`;
  const file = new File([`# ${draft.title}\n\n${draft.answer}\n`], filename, { type: "text/markdown" });
  try {
    const { error: uploadError } = await db.storage.from("knowledge-documents").upload(storagePath, file, { contentType: "text/markdown", upsert: true });
    if (uploadError) throw new Error("Approved content could not be stored.");
    const values = { title: draft.title, collection: draft.collection, assistant_scopes: draft.scopes, management_only: draft.managementOnly, knowledge_authority: "approved", status: "processing", size_bytes: file.size };
    const { data: existingDocument } = await db.from("knowledge_documents").select("id").eq("id", documentId).eq("organization_id", viewer.organizationId).maybeSingle();
    const write = existingDocument ? db.from("knowledge_documents").update(values).eq("id", documentId).eq("organization_id", viewer.organizationId) : db.from("knowledge_documents").insert({ ...values, id: documentId, organization_id: viewer.organizationId, uploaded_by: viewer.id, original_filename: filename, storage_path: storagePath, mime_type: "text/markdown", context_type: "knowledge" });
    const { error: documentError } = await write;
    if (documentError) throw new Error("Approved knowledge could not be saved.");
    const { error: linkError } = await db.from("ai_knowledge_gaps").update({ document_id: documentId }).eq("id", id).eq("organization_id", viewer.organizationId);
    if (linkError) throw new Error("The approved document could not be linked.");
    const result = await processKnowledgeDocument({ documentId, organizationId: viewer.organizationId, locationId: null, productId: null, sourceName: filename, file });
    if (!result.indexed) throw new Error("Content was saved, but indexing failed. Review and approve again to retry.");
    const { error: resolvedError } = await db.from("ai_knowledge_gaps").update({ status: "resolved" }).eq("id", id).eq("organization_id", viewer.organizationId);
    if (resolvedError) throw new Error("Knowledge was indexed, but the gap status could not be updated.");
    return { indexed: true, message: "Approved, indexed and available to the selected assistants." };
  } catch (error) {
    await db.from("ai_knowledge_gaps").update({ status: "draft" }).eq("id", id).eq("organization_id", viewer.organizationId);
    throw error;
  }
}
