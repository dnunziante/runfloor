import type { AppRole } from "./auth/viewer";

export type WorkspaceId = "sales" | "operations" | "executive";
export type NavigationItem = { label: string; href: string; icon: string; access?: "management" | "admin"; aliases?: string[] };
export type NavigationGroup = { label: string; items: NavigationItem[] };
export type WorkspaceNavigation = { id: WorkspaceId; label: string; icon: string; access?: "management"; groups: NavigationGroup[] };
const item = (label: string, href: string, icon: string, extra: Partial<NavigationItem> = {}): NavigationItem => ({ label, href, icon, ...extra });

export const workspaceNavigation: WorkspaceNavigation[] = [
  { id: "sales", label: "Sales", icon: "Users", groups: [
    { label: "Sales AI", items: [item("Sales AI Assistant", "/assistant", "Bot"), item("Suggested Prompts", "/assistant#suggested-prompts", "Sparkles"), item("Sales Tools", "/assistant#assistant-tools", "Boxes")] },
    { label: "Sales Tools", items: [item("Sales Dashboard", "/dashboard/performance", "BarChart3"), item("Quote & Loan Calculator", "/pricing-calculator", "Calculator", { aliases: ["/quote-calculator"] }), item("Products & Inventory", "/products", "Boxes"), item("Competitors", "/competitors", "Scale"), item("Product Comparisons", "/comparisons", "GitCompareArrows"), item("Message Center", "/messages", "Mail", { aliases: ["/email", "/text", "/generator"] }), item("Knowledge Base", "/knowledge-base", "BookOpen", { aliases: ["/knowledge"] }), item("Sales Analytics", "/analytics", "BarChart3")] },
    { label: "Sales Coaching", items: [item("Coach Dashboard", "/coach", "GraduationCap"), item("Training", "/training", "BookOpenCheck"), item("Objection Handling", "/objections", "MessageSquareQuote"), item("Practice Scenarios", "/coach/scenarios", "Target"), item("Role Play", "/role-play", "MessagesSquare", { aliases: ["/coach/session"] }), item("Session Review", "/coach/review", "BarChart3"), item("My Development", "/coach/development", "TrendingUp")] },
  ] },
  { id: "operations", label: "Operations", icon: "ClipboardCheck", groups: [
    { label: "Operations AI", items: [item("Operations AI Assistant", "/operations/assistant", "Bot"), item("Suggested Prompts", "/operations/assistant#suggested-prompts", "Sparkles"), item("Operations Tools", "/operations/assistant#assistant-tools", "Wrench")] },
    { label: "Daily Operations", items: [item("Operations Dashboard", "/operations", "LayoutDashboard"), item("Today’s Checklists", "/operations/checklists", "ClipboardCheck"), item("Procedures", "/operations/procedures", "BookOpenCheck"), item("Operational Alerts", "/operations/alerts", "AlertTriangle"), item("Recurring Schedules", "/operations/schedules", "CalendarClock"), item("Task Calendar", "/operations/calendar", "CalendarDays"), item("Handoff Logs", "/operations/handoffs", "ArrowRightLeft"), item("Incident Reports", "/operations/incidents", "ShieldAlert"), item("Process Improvement", "/operations/improvements", "Lightbulb"), item("Operations Performance", "/operations/performance", "Activity")] },
  ] },
  { id: "executive", label: "Executive", icon: "Crown", access: "management", groups: [
    { label: "Executive Intelligence", items: [item("Executive Dashboard", "/executive", "LayoutDashboard"), item("Executive AI Advisor", "/executive/assistant", "Bot"), item("Growth Opportunities", "/growth", "Lightbulb"), item("Priority Scoring", "/growth/priorities", "BarChart3"), item("Action Plans", "/growth/plans", "ClipboardCheck"), item("Performance", "/growth/performance", "Activity")] },
    { label: "Business Management", items: [item("Historical Trends", "/executive/trends", "TrendingUp"), item("Monthly Review", "/executive/review", "FileText"), item("Accountability", "/executive/accountability", "History"), item("Decision Log", "/executive/decisions", "Scale"), item("Sales Results", "/admin/sales-results", "BarChart3", { access: "admin" }), item("Data Quality", "/admin/sales-results/quality", "Search", { access: "admin" }), item("Executive Targets", "/admin/executive", "Settings", { access: "admin" })] },
    { label: "Executive Configuration", items: [item("Data Readiness", "/executive/readiness", "ListChecks"), item("Scoring Settings", "/admin/growth", "Settings", { access: "admin" }), item("Setup Guide", "/admin/executive/setup", "ListChecks", { access: "admin" })] },
  ] },
];

export function navigationAllowed(access: NavigationItem["access"], role: AppRole) {
  return !access || (access === "admin" ? role === "platform_owner" || role === "tenant_admin" : role !== "salesperson");
}

export function inventoryLabel(industry?: string) {
  return industry === "rv" ? "RVs & Inventory" : industry === "golf-cart" ? "Golf Carts & LSVs" : "Products & Inventory";
}

export function getWorkspaceNavigation(role: AppRole, industry?: string): WorkspaceNavigation[] {
  return workspaceNavigation.filter((workspace) => navigationAllowed(workspace.access, role)).map((workspace) => ({ ...workspace, groups: workspace.groups.map((group) => ({ ...group, items: group.items.filter((entry) => navigationAllowed(entry.access, role)).map((entry) => ({ ...entry, label: entry.href === "/products" ? inventoryLabel(industry) : entry.href === "/operations/improvements" && industry === "golf-cart" ? "Help Us Improve" : entry.label })) })).filter((group) => group.items.length > 0) }));
}

export function activeNavigationItem(pathname: string, navigation = workspaceNavigation): NavigationItem | undefined {
  // Most specific path wins: /coach/scenarios must not also highlight /coach.
  return navigation.flatMap((workspace) => workspace.groups.flatMap((group) => group.items)).filter((entry) => !entry.href.includes("#") && [entry.href, ...(entry.aliases ?? [])].some((href) => pathname === href || pathname.startsWith(`${href}/`))).sort((a, b) => Math.max(b.href.length, ...(b.aliases ?? []).map((href) => href.length)) - Math.max(a.href.length, ...(a.aliases ?? []).map((href) => href.length)))[0];
}

export function activeWorkspace(pathname: string): WorkspaceId | undefined {
  const active = activeNavigationItem(pathname);
  return workspaceNavigation.find((workspace) => workspace.groups.some((group) => group.items.includes(active!)))?.id;
}
