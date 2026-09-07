"use server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { canManageOperations } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { LibraryCommand, LibraryScope } from "@/lib/procedures/library";

export async function manageProcedureLibrary(scope: LibraryScope, command: LibraryCommand): Promise<{ error?: string; id?: string }> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || !["platform", "tenant"].includes(scope)
    || (scope === "platform" ? viewer.role !== "platform_owner" : !canManageOperations(viewer.role))) return { error: "Management access is required." };
  if (!command || typeof command.action !== "string") return { error: "Invalid management action." };
  if (command.id && !/^[0-9a-f-]{36}$/i.test(command.id)) return { error: "Invalid item." };
  if (command.action === "category_create" || command.action === "category_update") {
    if (typeof command.name !== "string" || command.name.trim().length < 2 || command.name.trim().length > (scope === "platform" ? 120 : 80)
      || (command.description !== undefined && (typeof command.description !== "string" || command.description.length > 1000))) return { error: "Enter a category name and a description of up to 1,000 characters." };
  }
  const client = await createClient();
  const { data, error } = await client.rpc(`manage_${scope}_procedure_library`, {
    action: command.action, item_id: command.id ?? null, payload: command,
    ...(scope === "tenant" ? { target_organization: viewer.organizationId } : {}),
  });
  if (error) return { error: error.code === "23503" ? "This item is used by other work. Move or archive it instead, or remove those references before deleting."
    : error.code === "23505" ? "A category with this name already exists, including archived categories."
    : error.message };
  revalidatePath("/admin/platform");
  revalidatePath("/operations", "layout");
  if (command.id && command.action.startsWith("procedure_")) revalidatePath(`/admin/platform/procedures/${command.id}`);
  return { id: data as string };
}
