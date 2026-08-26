"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, AlertTriangle, ArrowLeft, ArrowRightLeft, BarChart3, BookOpen, BookOpenCheck, Bot, Boxes, BriefcaseBusiness, Calculator, CalendarClock, CalendarDays, ChevronDown, ClipboardCheck, Crown, FileText, GitCompareArrows, GraduationCap, History, LayoutDashboard, Lightbulb, ListChecks, Mail, Menu, MessageSquareQuote, MessagesSquare, Scale, Search, Settings, ShieldAlert, ShieldCheck, Sparkles, Target, TrendingUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import { logout } from "@/app/auth/actions";
import { BrandLogo } from "@/components/brand-logo";
import type { Viewer } from "@/lib/auth/viewer";

const links = [
  ["Dashboard", "/dashboard", LayoutDashboard],
  ["Ask the Assistant", "/assistant", Bot],
  ["Loan Calculator", "/pricing-calculator", Calculator],
  ["Quote Calculator", "/quote-calculator", Calculator],
  ["Products", "/products", Boxes],
  ["Comparisons", "/comparisons", GitCompareArrows],
  ["Write an Email", "/email", Mail],
  ["Write a Text", "/text", MessagesSquare],
  ["Role Play", "/role-play", Sparkles],
  ["Training", "/training", GraduationCap],
  ["Knowledge Base", "/knowledge-base", BookOpen],
  ["Analytics", "/analytics", BarChart3],
  ["Admin", "/admin", ShieldCheck],
] as const;

const operationsLinks = [
  ["Operations Dashboard", "/operations", LayoutDashboard],
  ["Today’s Checklists", "/operations/checklists", ClipboardCheck],
  ["Procedures", "/operations/procedures", BookOpenCheck],
  ["Operational Alerts", "/operations/alerts", AlertTriangle],
  ["Recurring Schedules", "/operations/schedules", CalendarClock],
  ["Task Calendar", "/operations/calendar", CalendarDays],
  ["Handoff Logs", "/operations/handoffs", ArrowRightLeft],
  ["Incident Reports", "/operations/incidents", ShieldAlert],
  ["Process Improvement", "/operations/improvements", Lightbulb],
  ["Performance", "/operations/performance", Activity],
] as const;

const coachLinks = [
  ["Coach Dashboard", "/coach", GraduationCap],
  ["Objection Handling", "/objections", MessageSquareQuote],
  ["Practice Scenarios", "/coach/scenarios", Target],
  ["Start Role Play", "/coach/session", MessagesSquare],
  ["Session Review", "/coach/review", BarChart3],
  ["My Development", "/coach/development", TrendingUp],
] as const;

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [viewer, setViewer] = useState<Pick<Viewer, "fullName" | "initials" | "organizationId" | "organizationName" | "role" | "demo">>({
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
        if (data.role === "platform_owner") fetch("/api/auth/workspaces").then((response) => response.ok ? response.json() : null).then((workspaceData) => workspaceData && setWorkspaces(workspaceData.workspaces || [])).catch(() => undefined);
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
  const coachSectionActive = pathname.startsWith("/coach") || pathname === "/objections";
  const growthSectionActive = pathname.startsWith("/growth") || pathname.startsWith("/admin/growth");
  const operationsSectionActive = pathname.startsWith("/operations");
  const executiveSectionActive = pathname.startsWith("/executive") || pathname.startsWith("/admin/executive") || pathname.startsWith("/admin/sales-results");
  const executiveVisible = viewer.role === "platform_owner" || viewer.role === "tenant_admin" || viewer.role === "manager";
  const executiveSettingsVisible = viewer.role === "platform_owner" || viewer.role === "tenant_admin";
  const administratorVisible = viewer.role === "platform_owner" || viewer.role === "tenant_admin";
  const salesSectionActive = links.some(([, href]) => pathname === href || (href === "/admin" && pathname.startsWith("/admin") && !pathname.startsWith("/admin/growth") && !pathname.startsWith("/admin/executive") && !pathname.startsWith("/admin/sales-results")));
  return <div className="shell">
    {open && <button className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand-row sidebar-controls"><button className="icon-btn close-nav" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20}/></button></div>
      <Link className="sidebar-logo" href="/dashboard" aria-label="RunFloor dashboard" onClick={() => setOpen(false)}><BrandLogo priority/></Link>
      <div className="workspace"><span className="avatar avatar-square">{viewer.organizationName.charAt(0)}</span><span><small>{viewer.demo ? "Demo workspace" : viewer.role === "platform_owner" ? "Viewing workspace" : "Workspace"}</small>{viewer.role === "platform_owner" && workspaces.length > 0 ? <select className="workspace-select" value={viewer.organizationId} onChange={(event) => changeWorkspace(event.target.value)} aria-label="Switch workspace">{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select> : <strong>{viewer.organizationName}</strong>}</span>{viewer.role === "platform_owner" && workspaces.length > 0 ? null : <ChevronDown size={16}/>}</div>
      <nav className="nav module-nav" aria-label="Main navigation">
        <details className="module-group" key={`sales-${pathname}`} open={salesSectionActive}>
          <summary><span className="module-icon"><BriefcaseBusiness size={18}/></span><span>Sales Assistant</span><ChevronDown className="module-chevron" size={16}/></summary>
          <div className="module-links">{links.filter(([label]) => label !== "Admin" || administratorVisible).map(([label, href, Icon]) => {
            const active = pathname === href || (href === "/admin" && pathname.startsWith("/admin") && !pathname.startsWith("/admin/growth") && !pathname.startsWith("/admin/executive") && !pathname.startsWith("/admin/sales-results"));
            return <Link className={active ? "active" : ""} href={href} key={href} onClick={() => setOpen(false)}><Icon size={18}/><span>{label}</span></Link>;
          })}</div>
        </details>
        <details className="module-group" key={`coach-${pathname}`} open={coachSectionActive}>
          <summary><span className="module-icon"><GraduationCap size={18}/></span><span>Sales Coach</span><ChevronDown className="module-chevron" size={16}/></summary>
          <div className="module-links">{coachLinks.map(([label, href, Icon]) => {
            const active = pathname === href;
            return <Link className={active ? "active" : ""} href={href} key={href} onClick={() => setOpen(false)}><Icon size={18}/><span>{label}</span></Link>;
          })}</div>
        </details>
        <details className="module-group" key={`operations-${pathname}`} open={operationsSectionActive}>
          <summary><span className="module-icon"><ClipboardCheck size={18}/></span><span>Operations Assistant</span><ChevronDown className="module-chevron" size={16}/></summary>
          <div className="module-links">{operationsLinks.map(([label, href, Icon]) => <Link className={pathname === href || (href !== "/operations" && pathname.startsWith(`${href}/`)) ? "active" : ""} href={href} key={href} onClick={() => setOpen(false)}><Icon size={18}/><span>{label}</span></Link>)}</div>
        </details>
        <details className="module-group" key={`growth-${pathname}`} open={growthSectionActive}>
          <summary><span className="module-icon"><TrendingUp size={18}/></span><span>Business Growth Advisor</span><ChevronDown className="module-chevron" size={16}/></summary>
          <div className="module-links"><Link className={pathname === "/growth" || pathname.startsWith("/growth/opportunities") ? "active" : ""} href="/growth" onClick={() => setOpen(false)}><Lightbulb size={18}/><span>Growth Opportunities</span></Link><Link className={pathname === "/growth/priorities" ? "active" : ""} href="/growth/priorities" onClick={() => setOpen(false)}><BarChart3 size={18}/><span>Priority Scoring</span></Link><Link className={pathname === "/growth/plans" ? "active" : ""} href="/growth/plans" onClick={() => setOpen(false)}><ClipboardCheck size={18}/><span>Action Plans</span></Link><Link className={pathname === "/growth/performance" ? "active" : ""} href="/growth/performance" onClick={() => setOpen(false)}><Activity size={18}/><span>Performance</span></Link>{administratorVisible && <Link className={pathname === "/admin/growth" ? "active" : ""} href="/admin/growth" onClick={() => setOpen(false)}><Settings size={18}/><span>Scoring Settings</span></Link>}</div>
        </details>
        {executiveVisible && <details className="module-group" key={`executive-${pathname}`} open={executiveSectionActive}>
          <summary><span className="module-icon"><Crown size={18}/></span><span>Executive Advisor</span><ChevronDown className="module-chevron" size={16}/></summary>
          <div className="module-links"><Link className={pathname === "/executive" ? "active" : ""} href="/executive" onClick={() => setOpen(false)}><LayoutDashboard size={18}/><span>Command Center</span></Link><Link className={pathname === "/executive/readiness" ? "active" : ""} href="/executive/readiness" onClick={() => setOpen(false)}><ListChecks size={18}/><span>Data Readiness</span></Link><Link className={pathname === "/executive/trends" ? "active" : ""} href="/executive/trends" onClick={() => setOpen(false)}><TrendingUp size={18}/><span>Historical Trends</span></Link><Link className={pathname === "/executive/review" ? "active" : ""} href="/executive/review" onClick={() => setOpen(false)}><FileText size={18}/><span>Monthly Review</span></Link><Link className={pathname === "/executive/accountability" ? "active" : ""} href="/executive/accountability" onClick={() => setOpen(false)}><History size={18}/><span>Accountability</span></Link><Link className={pathname === "/executive/decisions" ? "active" : ""} href="/executive/decisions" onClick={() => setOpen(false)}><Scale size={18}/><span>Decision Log</span></Link>{executiveSettingsVisible && <><Link className={pathname === "/admin/executive/setup" ? "active" : ""} href="/admin/executive/setup" onClick={() => setOpen(false)}><ListChecks size={18}/><span>Setup Guide</span></Link><Link className={pathname === "/admin/sales-results" ? "active" : ""} href="/admin/sales-results" onClick={() => setOpen(false)}><BarChart3 size={18}/><span>Sales Results</span></Link><Link className={pathname === "/admin/sales-results/quality" ? "active" : ""} href="/admin/sales-results/quality" onClick={() => setOpen(false)}><Search size={18}/><span>Data Quality</span></Link><Link className={pathname === "/admin/executive" ? "active" : ""} href="/admin/executive" onClick={() => setOpen(false)}><Settings size={18}/><span>Executive Targets</span></Link></>}</div>
        </details>}
      </nav>
      <div className="sidebar-footer">{viewer.role === "platform_owner" && <Link href="/admin/platform"><Crown size={18}/> Platform Admin</Link>}{administratorVisible && <Link href="/admin/settings"><Settings size={18}/> Settings</Link>}<div className="profile"><span className="avatar">{viewer.initials}</span><span><strong>{viewer.fullName}</strong><small>{roleLabel}</small></span><form action={logout}><button className="logout-button" type="submit">{viewer.demo ? "Exit demo" : "Sign out"}</button></form></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="topbar-title"><button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={21}/></button><button className="btn btn-ghost" type="button" onClick={() => router.back()} aria-label="Go back to the previous page"><ArrowLeft size={16}/> Back</button><strong>{title}</strong></div><div className="top-actions"><button className="search-btn"><Search size={17}/><span>Search anything</span><kbd>⌘ K</kbd></button><span className="status-dot" title={viewer.demo ? "Demo environment" : "Connected"}/><span className="avatar">{viewer.initials}</span></div></header>
      <div className="content">{children}</div>
    </main>
  </div>;
}
