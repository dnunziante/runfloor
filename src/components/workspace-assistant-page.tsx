import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { canUseAssistant } from "@/lib/assistant/workspaces";
import type { WorkspaceId } from "@/lib/navigation";
import { WorkspaceAssistant } from "./workspace-assistant";

export async function WorkspaceAssistantPage({ workspace }: { workspace: WorkspaceId }) {
  const viewer = await getViewer();
  if (!viewer?.organizationId) redirect("/login");
  if (!canUseAssistant(workspace, viewer.role)) redirect("/dashboard");
  const industry = await getViewerIndustryTemplateKey(viewer);
  return <WorkspaceAssistant key={`${workspace}:${viewer.organizationId}:${viewer.id}`} workspace={workspace} userId={viewer.id} organizationId={viewer.organizationId} organizationName={viewer.organizationName} demo={viewer.demo} industry={industry ?? undefined}/>;
}
