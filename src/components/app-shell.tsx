"use client";

import Link from "next/link";
import { ENABLE_SALES_COACHING } from "@/lib/features";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Boxes, ChevronDown, ChevronsLeft, ChevronsRight, Home, LogOut, Menu, Settings, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";
import { logout } from "@/app/auth/actions";
import { WorkspaceSearch } from "@/components/workspace-search";
import { BrandLogo } from "@/components/brand-logo";
import { activeNavigationItem, activeWorkspace, getWorkspaceNavigation } from "@/lib/navigation";
import { navigationIcons } from "@/components/navigation-icons";
import type { Viewer } from "@/lib/auth/viewer";

export function AppShell({ children, title, industry }: { children: React.ReactNode; title: string; industry?: "rv" | "golf-cart" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [viewer, setViewer] = useState<Pick<Viewer, "fullName" | "initials" | "organizationId" | "organizationName" | "role" | "demo"> & { industryTemplateKey?: string }>({
    fullName: "User",
    initials: "U",
    organizationId: "",
    organizationName: "Workspace",
    role: "salesperson",
    demo: false,
  });

  useEffect(() => {
    fetch("/api/auth/context")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return;
        setViewer(data);
        if (!data.demo) fetch("/api/auth/workspaces").then((response) => response.ok ? response.json() : null).then((workspaceData) => workspaceData && setWorkspaces(workspaceData.workspaces || [])).catch(() => undefined);
      })
      .catch(() => undefined);
  }, []);

  async function changeWorkspace(organizationId: string) {
    if (!organizationId || organizationId === viewer.organizationId) return;
    const response = await fetch("/api/auth/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId }) });
    if (!response.ok) return;
    const workspace = workspaces.find((item) => item.id === organizationId);
    setViewer((current) => ({ ...current, organizationId, organizationName: workspace?.name || current.organizationName }));
    router.refresh();
    if (pathname !== "/dashboard") router.push("/dashboard");
  }

  const roleLabel = viewer.role === "platform_owner" ? "Platform Owner" : viewer.role === "tenant_admin" ? "Tenant Admin" : viewer.role === "manager" ? "Manager" : "Salesperson";
  const administratorVisible = viewer.role === "platform_owner" || viewer.role === "tenant_admin";
  const isRv = industry === "rv" || viewer.industryTemplateKey === "rv";
  const isGolfCart = industry === "golf-cart" || viewer.industryTemplateKey === "golf-cart";
  const navigation = getWorkspaceNavigation(viewer.role, industry ?? viewer.industryTemplateKey);
  const activeItem = activeNavigationItem(pathname, navigation);
  const expandedWorkspace = activeWorkspace(pathname) ?? (pathname === "/dashboard" ? "sales" : undefined);
  return <div className={`shell ${!ENABLE_SALES_COACHING ? "coaching-disabled" : ""} ${collapsed ? "sidebar-collapsed" : ""} ${isRv ? "rv-shell" : ""} ${isGolfCart ? "golf-cart-shell" : ""}`}>
    {open && <button className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand-row sidebar-controls"><button className="icon-btn collapse-sidebar" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronsRight size={22}/> : <ChevronsLeft size={22}/>}</button><button className="icon-btn close-nav" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20}/></button></div>
      <Link className="sidebar-logo" href="/dashboard" aria-label="RunFloor dashboard" onClick={() => setOpen(false)}><BrandLogo priority/></Link>
      <div className="workspace"><span className="avatar avatar-square">{viewer.organizationName.charAt(0)}</span><span><small>{viewer.demo ? "Demo workspace" : "Viewing workspace"}</small>{workspaces.length > 1 ? <select className="workspace-select" value={viewer.organizationId} onChange={(event) => changeWorkspace(event.target.value)} aria-label="Switch workspace">{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select> : <strong>{viewer.organizationName}</strong>}</span>{workspaces.length > 1 ? null : <ChevronDown size={16}/>}</div>
      <nav className="nav module-nav" aria-label="Main navigation">
        <Link className={pathname === "/dashboard" ? "active" : ""} href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined} onClick={() => setOpen(false)}><Home size={18}/><span>Home</span></Link>
        {navigation.map((workspace) => {
          const WorkspaceIcon = navigationIcons[workspace.icon] ?? Boxes;
          return <details name="business-workspaces" className="module-group workspace-group" key={workspace.id + pathname} open={expandedWorkspace === workspace.id}>
            <summary aria-label={workspace.label + " workspace"} title={workspace.label} onClick={() => collapsed && setCollapsed(false)}><span className="module-icon"><WorkspaceIcon size={18}/></span><span>{workspace.label}</span><ChevronDown className="module-chevron" size={16}/></summary>
            <div className="module-links">{workspace.groups.map((group) => <div className="workspace-nav-group" key={group.label}><h2>{group.label}</h2>{group.items.map((entry) => {
              const Icon = navigationIcons[entry.icon] ?? Boxes;
              const active = activeItem?.href === entry.href;
              return <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={entry.href} key={entry.href} onClick={() => setOpen(false)}><Icon size={18}/><span>{entry.label}</span></Link>;
            })}</div>)}</div>
          </details>;
        })}
      </nav>
      <div className="sidebar-footer">{administratorVisible && <Link href="/admin"><Settings size={18}/><span>Platform Administration</span><ChevronDown className="footer-chevron" size={16}/></Link>}{administratorVisible && <Link href="/admin/settings"><Wrench size={18}/><span>Settings</span><ChevronDown className="footer-chevron" size={16}/></Link>}<div className="profile"><span className="avatar">{viewer.initials}</span><span><strong>{viewer.fullName}</strong><small>{roleLabel}</small></span><form action={logout}><button className="logout-button" type="submit"><LogOut size={17}/><span>{viewer.demo ? "Exit demo" : "Sign out"}</span></button></form></div><div className="sidebar-motto">People <i/> Processes <i/> Profit</div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="topbar-title"><button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={21}/></button><button className="btn btn-ghost" type="button" onClick={() => router.back()} aria-label="Go back to the previous page"><ArrowLeft size={16}/> Back</button><strong>{title}</strong></div><div className="top-actions"><WorkspaceSearch role={viewer.role} industry={industry ?? viewer.industryTemplateKey}/><span className="status-dot" title={viewer.demo ? "Demo environment" : "Connected"}/><span className="avatar">{viewer.initials}</span></div></header>
      <div className="content">{children}</div>
    </main>
  </div>;
}
