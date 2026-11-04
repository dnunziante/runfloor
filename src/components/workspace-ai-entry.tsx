import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import { assistantWorkspaces } from "@/lib/assistant/workspaces";
import type { WorkspaceId } from "@/lib/navigation";

export function WorkspaceAIEntry({ workspace }: { workspace: WorkspaceId }) {
  const assistant = assistantWorkspaces[workspace];
  return <Link className="workspace-ai-entry" href={workspace === "sales" ? "/assistant" : `/${workspace}/assistant`}><Bot size={23}/><span><strong>{assistant.title}</strong><small>{assistant.tagline}</small></span><ArrowRight size={19}/></Link>;
}
