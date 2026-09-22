import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ReportingPeriodSelector } from "@/components/reporting-period-selector";
import { SalesDataQualityReview } from "@/components/sales-data-quality-review";
import { getSalesDataQualityWorkspace } from "@/lib/sales/results";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { RvSalesDataQuality } from "@/components/rv-sales-data-quality";

export default async function SalesDataQualityPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) { const { period } = await searchParams; const [workspace, viewer] = await Promise.all([getSalesDataQualityWorkspace(period), getViewer()]); if (!workspace.canManage || !viewer) redirect("/executive"); const templateKey = await getViewerIndustryTemplateKey(viewer); const workspaceName = viewer.organizationName.trim().toLowerCase(); if (templateKey === "rv" || workspaceName === "runfloor demo" || workspaceName === "rayne rv") return <AppShell title="Sales Data Quality" industry="rv"><RvSalesDataQuality workspace={workspace}/></AppShell>; return <AppShell title="Sales Data Quality"><PageHeader eyebrow="Administrator review" title="Confirm reporting readiness" description="See which locations are approved, still in draft, missing, or relying on an older reporting month." action={<Link className="btn btn-ghost" href="/admin/sales-results"><ArrowLeft size={16}/> Sales results</Link>}/><div className="callout executive-disclaimer"><Info size={20}/><div><strong>Deterministic review</strong><p>Status comes directly from tenant records. No forecasting, inferred values, or AI-generated figures are used.</p></div></div><ReportingPeriodSelector action="/admin/sales-results/quality" periods={workspace.availablePeriods} selected={workspace.reportingPeriod}/>{workspace.error && <p className="form-error">{workspace.error}</p>}<SalesDataQualityReview workspace={workspace}/></AppShell>; }
