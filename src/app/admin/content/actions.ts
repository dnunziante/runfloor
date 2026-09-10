"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export type ContentActionState = { error: string; success: string };
const allowedTypes = new Set([
  "sales_script",
  "objection_response",
  "email_template",
  "text_template",
]);

export async function saveSalesContent(
  _previousState: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const viewer = await getViewer();
  if (
    !viewer?.organizationId ||
    viewer.demo ||
    !["tenant_admin", "platform_owner"].includes(viewer.role)
  )
    return {
      error: "Sign in as a tenant administrator to save shared sales content.",
      success: "",
    };
  const id = String(formData.get("id") || "");
  const contentType = String(formData.get("contentType") || "");
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const status = String(
    formData.get("statusTarget") || formData.get("status") || "draft",
  );
  const category = String(formData.get("category") || "")
    .trim()
    .slice(0, 120);
  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
  if (
    !allowedTypes.has(contentType) ||
    (id && !/^[0-9a-f-]{36}$/i.test(id)) ||
    title.length < 2 ||
    title.length > 160 ||
    body.length < 2 ||
    body.length > 12000 ||
    !["draft", "published", "archived"].includes(status)
  )
    return {
      error: "Enter a title and content, then choose a valid status.",
      success: "",
    };
  const supabase = await createClient();
  const record = {
    organization_id: viewer.organizationId,
    content_type: contentType,
    title,
    body,
    status,
    category,
    tags,
    created_by: viewer.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = id
    ? await supabase
        .from("sales_content_items")
        .update(record)
        .eq("id", id)
        .eq("organization_id", viewer.organizationId)
    : await supabase.from("sales_content_items").insert(record);
  if (error)
    return {
      error: "The content could not be saved to the shared workspace.",
      success: "",
    };
  revalidatePath(`/admin/content/${contentType}`);
  revalidatePath("/admin/content");
  return { error: "", success: "Saved to the shared BGC workspace." };
}
