"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { getPermissionMatrix } from "@/lib/auth/role-permissions-server";
import { canEditPosition, defaultPermissions, positions, positionLabels, validatePermissions, type Position } from "@/lib/auth/role-permissions";
import { createClient } from "@/lib/supabase/server";

export async function savePositionPermissions(_previous: { error: string; success: string }, formData: FormData) {
  const viewer = await getViewer();
  const target = String(formData.get("position")) as Position;
  if (!viewer?.organizationId || !positions.includes(target) || !canEditPosition(viewer.role, target)) return { error: "You do not have permission to change this position.", success: "" };
  if (viewer.demo) return { error: "The demo is read-only. Sign in to save workspace permissions.", success: "" };
  try {
    const matrix = await getPermissionMatrix(viewer);
    const selected = JSON.parse(String(formData.get("permissions") ?? "null"));
    const ceiling = viewer.role === "manager" ? matrix.manager.permissions : defaultPermissions("tenant_admin");
    const revision = Number(formData.get("revision"));
    if (!Number.isSafeInteger(revision) || revision < 0 || !validatePermissions(selected, target, viewer.role, ceiling, matrix[target].permissions)) return { error: "That selection is outside your role limits.", success: "" };
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_role_permissions", { target_org: viewer.organizationId, target_role: target, selected_permissions: selected, expected_revision: revision });
    if (error) return { error: error.code === "40001" ? "Someone else changed these permissions. Reload before saving." : "Permissions could not be saved. Reload and check your access.", success: "" };
    revalidatePath("/", "layout");
    return { error: "", success: `${positionLabels[target]} permissions saved for this workspace.` };
  } catch { return { error: "Permissions could not be loaded or saved. Please try again.", success: "" }; }
}
