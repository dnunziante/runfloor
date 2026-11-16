import "server-only";
import { createClient } from "@/lib/supabase/server";
import { defaultPermissionMatrix, positions, type PermissionMatrix, type Position } from "./role-permissions";
import type { Viewer } from "./viewer";

export async function getPermissionMatrix(viewer: Viewer): Promise<PermissionMatrix> {
  const matrix = defaultPermissionMatrix();
  if (viewer.demo) return matrix;
  const supabase = await createClient();
  const { data, error } = await supabase.from("organization_role_permissions").select("role,permissions,revision").eq("organization_id", viewer.organizationId);
  if (error) throw new Error("Role permissions are unavailable. Please try again.");
  for (const row of data ?? []) {
    if (positions.includes(row.role as Position)) matrix[row.role as Position] = { permissions: row.permissions, revision: row.revision };
  }
  return matrix;
}
