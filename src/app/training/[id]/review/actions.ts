"use server";

import { assertSalesCoachingEnabled } from "@/lib/features";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { parseGeneratedTrainingContent, validateGeneratedTrainingContent, validateQuestionEvidence } from "@/lib/training/generated";

export type LessonActionState = { error: string; success: string; published?: boolean };

export async function saveGeneratedLesson(_previous: LessonActionState, formData: FormData): Promise<LessonActionState> {
  assertSalesCoachingEnabled();
  const viewer = await getViewer();
  if (!viewer?.organizationId || !["manager", "tenant_admin", "platform_owner"].includes(viewer.role)) return { error: "Manager access is required.", success: "" };
  const lessonId = String(formData.get("lessonId") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const intent = formData.get("intent") === "publish" ? "publish" : "draft";
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return { error: "Choose a valid lesson.", success: "" };
  if (title.length < 2 || title.length > 140) return { error: "Enter a title between 2 and 140 characters.", success: "" };

  let content;
  try {
    content = parseGeneratedTrainingContent(JSON.parse(String(formData.get("content") || "{}")));
  } catch {
    return { error: "The lesson content is not valid.", success: "" };
  }
  const contentError = validateGeneratedTrainingContent(content, formData.get("includeKnowledgeCheck") === "true");
  if (contentError) return { error: contentError, success: "" };

  const supabase = await createClient();
  const { data: lesson, error: lessonError } = await supabase.from("training_lessons")
    .select("id, knowledge_document_id, is_published, include_knowledge_check")
    .eq("id", lessonId).eq("organization_id", viewer.organizationId).maybeSingle();
  if (lessonError || !lesson) return { error: "This lesson is unavailable or outside your permitted locations.", success: "" };

  if (content.knowledgeCheck.length) {
    const { data: chunks, error: chunkError } = await supabase.from("knowledge_document_chunks").select("content")
      .eq("organization_id", viewer.organizationId).eq("document_id", lesson.knowledge_document_id).order("chunk_index");
    if (chunkError || !chunks?.length || !validateQuestionEvidence(content, chunks.map((chunk) => chunk.content).join("\n\n"))) {
      return { error: "Each quiz answer needs an exact supporting source excerpt from this document.", success: "" };
    }
  }

  const publish = intent === "publish";
  const now = new Date().toISOString();
  const { data: saved, error } = await supabase.from("training_lessons").update({
    title,
    description,
    generated_content: content,
    generation_status: "ready",
    generation_error: null,
    is_published: publish || lesson.is_published,
    published_at: publish ? now : undefined,
    published_by: publish ? viewer.id : undefined,
    source_review_required: publish ? false : undefined,
    updated_at: now,
  }).eq("id", lessonId).eq("organization_id", viewer.organizationId).select("id").maybeSingle();
  if (error || !saved) return { error: "The lesson could not be saved. Check your role and location access.", success: "" };

  revalidatePath("/training");
  revalidatePath(`/training/${lessonId}`);
  revalidatePath(`/training/${lessonId}/review`);
  revalidatePath("/training/review");
  revalidatePath("/knowledge-base");
  return { error: "", success: publish ? "Lesson published to permitted employees." : "Draft saved.", published: publish || lesson.is_published };
}
