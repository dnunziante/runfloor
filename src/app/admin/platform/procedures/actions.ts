"use server";

import { activeProcedureRows, isProcedureLibraryReady } from "@/lib/procedures/library-availability";
import { revalidatePath } from "next/cache";
import { type JSONContent } from "@tiptap/core";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { isPlatformTemplateEditor, templateColumns, type ProcedureTemplate } from "@/lib/procedures/document";
import { validateDocument } from "@/lib/procedures/validation";

async function authorizedTemplate(id: string) {
  const viewer = await getViewer();
  if (!isPlatformTemplateEditor(viewer) || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Platform owner access is required.");
  const supabase = await createClient();
  const { data, error } = await activeProcedureRows(supabase.from("platform_procedure_templates").select(templateColumns).eq("id", id), await isProcedureLibraryReady("platform")).single();
  if (error || !data) throw new Error("This procedure is unavailable.");
  return { viewer: viewer!, supabase, template: data as ProcedureTemplate };
}
export async function updateProcedureTemplate(input: { id: string; updatedAt: string; title: string; category: string; owner: string; summary: string; document?: JSONContent }) {
  try {
    const { supabase, template } = await authorizedTemplate(input.id);
    if (typeof input.title !== "string" || input.title.trim().length < 2 || input.title.length > 160 || typeof input.category !== "string" || !input.category.trim() || input.category.length > 120 || typeof input.owner !== "string" || input.owner.length > 120 || typeof input.summary !== "string" || input.summary.length > 100_000) throw new Error("Enter a title (2–160 characters), category, and valid team and purpose.");
    if (input.document !== undefined) validateDocument(input.document);
    const content = input.document === undefined ? template.content : { ...template.content, runfloorDocument: { format: "tiptap-v1", document: input.document } };
    const { data, error } = await activeProcedureRows(supabase.from("platform_procedure_templates").update({ title: input.title, category: input.category, owner: input.owner, summary: input.summary, content, version: template.version + 1, updated_at: new Date().toISOString() }).eq("id", template.id).eq("updated_at", input.updatedAt), await isProcedureLibraryReady("platform")).select(templateColumns).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("This procedure changed while you were editing. Reload it before saving; your changes have not been saved.");
    revalidatePath("/admin/platform"); revalidatePath(`/admin/platform/procedures/${template.id}`);
    return { template: data as ProcedureTemplate };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : "The procedure could not be saved." }; }
}
export async function duplicateProcedureTemplate(id: string) {
  try {
    const { supabase, viewer, template } = await authorizedTemplate(id);
    const title = `${template.title.slice(0, 153)} - Copy`;
    const { data, error } = await supabase.from("platform_procedure_templates").insert({ title, category: template.category, owner: template.owner, summary: template.summary, steps: template.steps, content: template.content, version: template.version, is_published: template.is_published, created_by: viewer.id }).select(templateColumns).single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/platform");
    return { template: data as ProcedureTemplate };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : "The procedure could not be duplicated." }; }
}
