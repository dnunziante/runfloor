"use client";
import { effectivePlanKey } from "@/lib/plans/policy";

import { WorkspaceLocations } from "./workspace-locations";
import Link from "next/link";
import { ENABLE_SALES_COACHING } from "@/lib/features";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Boxes, ChevronDown, ChevronsLeft, ChevronsRight, Home, LogOut, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/auth/actions";
import { WorkspaceSearch } from "@/components/workspace-search";
import { BrandLogo } from "@/components/brand-logo";
import { activeNavigationItem, activeWorkspace, getWorkspaceNavigation } from "@/lib/navigation";
import { activeSidebarItem, getSidebarNavigation } from "@/lib/sidebar-navigation";
import { navigationIcons } from "@/components/navigation-icons";
import { hasPagePermission, permissionDefinitions, type RolePermissions } from "@/lib/auth/role-permissions";
import type { Viewer } from "@/lib/auth/viewer";

export function AppShell({ children, title, industry }: { children: React.ReactNode; title: string; industry?: "rv" | "golf-cart" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [locationNames, setLocationNames] = useState<string[]>([]);
  const [workspaceError, setWorkspaceError] = useState("");
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
  const [locationError, setLocationError] = useState("");
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [viewer, setViewer] = useState<Pick<Viewer, "fullName" | "initials" | "organizationId" | "organizationName" | "role" | "demo" | "permissions" | "plan"> & { industryTemplateKey?: string }>({
    fullName: "User",
    initials: "U",
    organizationId: "",
    organizationName: "Workspace",
    role: "salesperson",
    demo: false,
    permissions: Object.fromEntries(permissionDefinitions.map(p=>[p.key,false])) as RolePermissions,
  });

  useEffect(() => {
    fetch("/api/auth/context")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return;
        setViewer(data);
        setLocationNames(data.locations || []);
        setLocationError(data.locationError || "");
        if (!data.demo) fetch("/api/auth/workspaces").then((response) => response.ok ? response.json() : null).then((workspaceData) => workspaceData && setWorkspaces(workspaceData.workspaces || [])).catch(() => undefined);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    const sidebar = sidebarRef.current;
    const menuButton = menuRef.current;
    const controls = () => Array.from(sidebar?.querySelectorAll<HTMLElement>('a[href],button,select,summary,input') || []).filter(element => element.getBoundingClientRect().width > 0 && !element.closest('details:not([open]) .module-links'));
    controls()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key !== "Tab") return;
      const items = controls(), first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); menuButton?.focus(); };
  }, [open]);

  async function changeWorkspace(organizationId: string) {
    if (!organizationId || organizationId === viewer.organizationId) return;
    setSwitchingWorkspace(true); setWorkspaceError("");
    try {
      const response = await fetch("/api/auth/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId }) });
      if (!response.ok) throw new Error("Workspace could not be changed. Your current workspace is still selected. Try again.");
      window.dispatchEvent(new Event("opal:reset"));
      window.location.assign(new URL("/dashboard", window.location.origin).href);
    } catch { setWorkspaceError("Workspace could not be changed. Your current workspace is still selected. Try again."); setSwitchingWorkspace(false); }
  }

  const roleLabel = viewer.role === "platform_owner" ? "Platform Owner" : viewer.role === "tenant_admin" ? "Tenant Admin" : viewer.role === "manager" ? "Manager" : "Salesperson";
  const isRv = industry === "rv" || viewer.industryTemplateKey === "rv";
  const isGolfCart = industry === "golf-cart" || viewer.industryTemplateKey === "golf-cart";
  const navigation = getWorkspaceNavigation(viewer.role, industry ?? viewer.industryTemplateKey).map(workspace => ({ ...workspace, groups: workspace.groups.map(group => ({ ...group, items: group.items.filter(item => hasPagePermission(viewer.role, item.href, viewer.permissions, effectivePlanKey(viewer.plan))) })).filter(group => group.items.length) })).filter(workspace => workspace.groups.length);
  const activeItem = activeNavigationItem(pathname, navigation);
  const sidebarGroups = getSidebarNavigation(viewer.role).map(group => ({ ...group, items: group.items.map(item => item.href === "/admin/settings" && effectivePlanKey(viewer.plan) !== "sales_solo" && !hasPagePermission(viewer.role, item.href, viewer.permissions, effectivePlanKey(viewer.plan)) ? { ...item, href: "/admin/settings/roles" } : item).filter(item => hasPagePermission(viewer.role, item.href, viewer.permissions, effectivePlanKey(viewer.plan))) })).filter(group => group.items.length);
  const activeFooterItem = activeItem ? undefined : activeSidebarItem(pathname, sidebarGroups);
  const activeFooterGroup = sidebarGroups.find(group => group.items.some(item => item.href === activeFooterItem?.href))?.id;
  const expandedWorkspace = activeWorkspace(pathname) ?? (pathname === "/dashboard" ? "sales" : undefined);
  return <div className={`shell ${!ENABLE_SALES_COACHING ? "coaching-disabled" : ""} ${collapsed ? "sidebar-collapsed" : ""} ${isRv ? "rv-shell" : ""} ${isGolfCart ? "golf-cart-shell" : ""}`}>
    {open && <button className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <aside ref={sidebarRef} className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand-row sidebar-controls"><button className="icon-btn collapse-sidebar" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronsRight size={22}/> : <ChevronsLeft size={22}/>}</button><button className="icon-btn close-nav" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20}/></button></div>
      <Link className="sidebar-logo" href="/dashboard" aria-label="RunFloor dashboard" onClick={() => setOpen(false)}><BrandLogo priority/></Link>
      <div className="workspace"><span className="avatar avatar-square">{viewer.organizationName.charAt(0)}</span><span><small>{viewer.demo ? "Demo workspace" : "Viewing workspace"}</small>{workspaces.length > 1 ? <select disabled={switchingWorkspace} className="workspace-select" value={viewer.organizationId} onChange={(event) => changeWorkspace(event.target.value)} aria-label="Switch workspace">{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select> : <strong>{viewer.organizationName}</strong>}</span>{workspaces.length > 1 ? null : <ChevronDown size={16}/>}</div>
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
      <div className="sidebar-footer">
        <nav className="nav utility-nav" aria-label="Help, billing and administration">
          {sidebarGroups.map(group => {
            const GroupIcon = navigationIcons[group.icon] ?? Boxes;
            return <details name="sidebar-utilities" className="module-group utility-group" key={group.id + pathname + viewer.role} open={activeFooterGroup === group.id}>
              <summary aria-label={group.label} title={group.label} onClick={() => collapsed && setCollapsed(false)}><span className="module-icon"><GroupIcon size={18}/></span><span className="utility-label">{group.label}</span><ChevronDown className="module-chevron" size={16}/></summary>
              <div className="module-links">{group.items.map(entry => {
                const Icon = navigationIcons[entry.icon] ?? Boxes;
                const active = activeFooterItem?.href === entry.href;
                return <Link href={entry.href} key={entry.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}><Icon size={16}/><span>{entry.label}</span></Link>;
              })}</div>
            </details>;
          })}
        </nav><div className="profile"><span className="avatar">{viewer.initials}</span><span><strong>{viewer.fullName}</strong><small>{roleLabel}</small></span><form action={logout} onSubmit={() => window.dispatchEvent(new Event("opal:reset"))}><button className="logout-button" type="submit"><LogOut size={17}/><span>{viewer.demo ? "Exit demo" : "Sign out"}</span></button></form></div><div className="sidebar-motto">People <i/> Processes <i/> Profit</div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="topbar-title"><button ref={menuRef} aria-expanded={open} className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={21}/></button><button className="btn btn-ghost" type="button" onClick={() => router.back()} aria-label="Go back to the previous page"><ArrowLeft size={16}/> Back</button><strong>{title}</strong></div><div className="top-actions"><WorkspaceSearch planKey={effectivePlanKey(viewer.plan)} permissions={viewer.permissions} role={viewer.role} industry={industry ?? viewer.industryTemplateKey}/><span className="status-dot" title={viewer.demo ? "Demo environment" : "Connected"}/><span className="avatar">{viewer.initials}</span></div></header>
      <div className="content" onClick={event => { const anchor = (event.target as Element).closest?.('a[href^="#"]'); const id = anchor?.getAttribute("href")?.slice(1); if (id) { const panel = document.getElementById(id)?.closest("details.workspace-create-panel"); if (panel instanceof HTMLDetailsElement) panel.open = true; } }}><WorkspaceLocations.Provider value={locationNames}>{switchingWorkspace && <p role="status">Switching workspace…</p>}{workspaceError && <p className="form-error" role="alert">{workspaceError}</p>}{locationError && <p role="alert" className="form-error">Workspace locations could not be loaded. Refresh before assigning location-specific work.</p>}{children}</WorkspaceLocations.Provider></div>
    </main>
  </div>;
}
