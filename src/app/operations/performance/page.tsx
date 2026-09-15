import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OperationsPerformanceDashboard } from "@/components/operations-performance-dashboard";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getOperationsWorkspace } from "@/lib/operations/repository";
import styles from "./performance.module.css";

export default async function OperationsPerformancePage() {
  const [data, viewer] = await Promise.all([getOperationsWorkspace(), getViewer()]);
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspaceName = viewer?.organizationName.trim().toLowerCase() || "";
  const tailored = Boolean(viewer && (templateKey === "golf-cart" || viewer.demo || workspaceName === "runfloor demo" || workspaceName === "rayne rv"));
  const isRv = templateKey === "rv" || workspaceName === "rayne rv" || (viewer?.demo && workspaceName === "runfloor rv");
  const shared = data.persistence === "supabase";

  return <AppShell title="Operations Performance" industry={isRv ? "rv" : undefined}>
    {tailored ? <main className={styles.performanceExperience}><section className={styles.hero}><div><span className={styles.eyebrow}>Measure execution</span><h1>See where operational work<br/>is on track — and where it’s not.</h1><p>Drive consistency. Solve issues faster. Keep your dealership running smoothly.</p></div><blockquote>Operational<br/>Excellence<br/>Drives<br/>Adventures.</blockquote></section><OperationsPerformanceDashboard tailored initialChecklists={data.checklists} initialAlerts={data.alerts} persistence={data.persistence} initialError={data.error}/></main> : <><PageHeader eyebrow="Measure execution" title="See where operational work is on track—and where it is not" description="Compare checklist completion, overdue work, and alert follow-through across locations using transparent calculations." action={<Link className="btn btn-ghost" href="/operations"><ArrowLeft size={16}/> Operations dashboard</Link>}/><div className="callout operations-disclaimer"><Info size={20}/><div><strong>{shared ? "Shared operational performance" : "Browser-local performance"}</strong><p>{shared ? "Metrics use tenant-scoped checklists and alert history stored in Supabase." : "Metrics use only the sample and locally saved checklist and alert records in this browser. They are not live dealership results."}</p></div></div><OperationsPerformanceDashboard initialChecklists={data.checklists} initialAlerts={data.alerts} persistence={data.persistence} initialError={data.error}/></>}
  </AppShell>;
}
