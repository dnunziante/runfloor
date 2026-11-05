"use server";

import { assertSalesCoachingEnabled } from "@/lib/features";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { isLocalDemoMode } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type TrainingCompletionState = { error: string; success: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function completeTrainingLesson(_previous: TrainingCompletionState, formData: FormData): Promise<TrainingCompletionState> {
  assertSalesCoachingEnabled();
  const lessonId = String(formData.get("lessonId") || "");
  if (!uuidPattern.test(lessonId)) return { error: "The training lesson is invalid.", success: "" };
  if (isLocalDemoMode()) return { error: "", success: "Training completed." };
  const viewer = await getViewer();
  if (!viewer?.organizationId) return { error: "Sign in to record training completion.", success: "" };
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("training_lessons").select("id").eq("id", lessonId).eq("organization_id", viewer.organizationId).eq("is_published", true).maybeSingle();
  if (!lesson) return { error: "This lesson is unavailable.", success: "" };
  const now = new Date().toISOString();
  const { error } = await supabase.from("training_progress").upsert({ organization_id: viewer.organizationId, user_id: viewer.id, lesson_id: lessonId, status: "completed", started_at: now, completed_at: now, updated_at: now }, { onConflict: "organization_id,user_id,lesson_id" });
  if (error) return { error: "Your training completion could not be saved.", success: "" };
  revalidatePath("/training");
  revalidatePath(`/training/${lessonId}`);
  return { error: "", success: "Training completed." };
}
