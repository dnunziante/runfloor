import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import { getWorkspaceNavigation } from "@/lib/navigation";
import { navigationIcons } from "@/components/navigation-icons";
import type { AppRole } from "@/lib/auth/viewer";

export function WorkspaceLaunchpad({ role }: { role: AppRole }) {
  return <nav className="workspace-launchpad" aria-label="Business workspaces">{getWorkspaceNavigation(role).map((workspace) => {
    const Icon = navigationIcons[workspace.icon];
    const dashboard = workspace.id === "sales" ? "/dashboard/performance" : `/${workspace.id}`;
    const assistant = workspace.id === "sales" ? "/assistant" : `/${workspace.id}/assistant`;
    return <section key={workspace.id}><Link href={dashboard}><Icon size={23}/><span><strong>{workspace.label}</strong><small>{workspace.id === "sales" ? "Revenue, inventory and coaching" : workspace.id === "operations" ? "Daily work and execution" : "Management and growth"}</small></span><ArrowRight size={17}/></Link><Link href={assistant}><Bot size={16}/>{workspace.id === "executive" ? "Open AI Advisor" : "Open AI Assistant"}</Link></section>;
  })}</nav>;
}
