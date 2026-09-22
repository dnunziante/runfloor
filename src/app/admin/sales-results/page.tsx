import { redirect } from "next/navigation";
import Link from "next/link";
import { SearchCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SalesResultsManager } from "@/components/sales-results-manager";
import { getSalesResultsWorkspace } from "@/lib/sales/results";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { RvSalesResultsManager } from "@/components/rv-sales-results-manager";

export default async function SalesResultsPage() { const [workspace, viewer] = await Promise.all([getSalesResultsWorkspace(), getViewer()]); if (!workspace.canManage || !viewer) redirect("/executive"); const templateKey = await getViewerIndustryTemplateKey(viewer); const workspaceName = viewer.organizationName.trim().toLowerCase(); if (templateKey === "rv" || workspaceName === "runfloor demo" || workspaceName === "rayne rv") return <AppShell title="Sales Results" industry="rv"><RvSalesResultsManager workspace={workspace}/></AppShell>; return <AppShell title="Sales Results"><PageHeader eyebrow="Administrator data source" title="Approve monthly sales results" description="Enter verified location results. Only approved records feed the Executive Advisor." action={<Link className="btn btn-secondary" href="/admin/sales-results/quality"><SearchCheck size={16}/> Review data quality</Link>}/>{workspace.error && <div className="card error-card"><h2>Sales results unavailable</h2><p>{workspace.error}</p></div>}<SalesResultsManager workspace={workspace}/></AppShell>; }
