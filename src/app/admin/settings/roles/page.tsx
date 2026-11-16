import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RolePermissionsEditor } from "@/components/role-permissions-editor";
import { getViewer } from "@/lib/auth/viewer";
import { getPermissionMatrix } from "@/lib/auth/role-permissions-server";
import { defaultPermissionMatrix, positions, type Position } from "@/lib/auth/role-permissions";

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ previewRole?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const localPreview = process.env.NODE_ENV !== "production" && viewer.demo;
  const requestedPreviewRole = (await searchParams).previewRole as Position;
  const actor = localPreview && positions.includes(requestedPreviewRole) ? requestedPreviewRole : viewer.role;
  let matrix = defaultPermissionMatrix();
  let error = "";
  try { matrix = await getPermissionMatrix(viewer); } catch { error = "Permissions could not be loaded. Reload this page before making changes."; }
  return <AppShell title="Settings · Roles & Permissions">
    <PageHeader eyebrow="Settings" title="Roles & Permissions" description="Choose what each position can access in this workspace."/>
    {localPreview && <p className="demo-note">Preview only. Checkbox changes are not saved.</p>}
    <RolePermissionsEditor matrix={matrix} actor={actor} readOnly={(viewer.demo && !localPreview) || Boolean(error)} error={error}/>
  </AppShell>;
}
