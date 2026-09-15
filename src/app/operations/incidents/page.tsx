import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OperationsIncidentManager } from "@/components/operations-incident-manager";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getOperationsWorkspace } from "@/lib/operations/repository";
import styles from "./incidents.module.css";

export default async function OperationsIncidentsPage() {
  const [data, viewer] = await Promise.all([getOperationsWorkspace(), getViewer()]);
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspaceName = viewer?.organizationName.trim().toLowerCase() || "";
  const tailoredExperience = Boolean(viewer && (templateKey === "golf-cart" || viewer.demo || workspaceName === "runfloor demo" || workspaceName === "rayne rv"));
  const isRv = templateKey === "rv" || workspaceName === "rayne rv" || (viewer?.demo && workspaceName === "runfloor rv");
  const shared = data.persistence === "supabase";

  return <AppShell title="Incident Reports" industry={isRv ? "rv" : undefined}>
    {tailoredExperience ? <main className={styles.incidentExperience}>
      <section className={styles.hero}>
        <div><span className={styles.eyebrow}>Incident reports</span><h1>Identify Issues. Find Solutions.<br/><em>Keep Our Dealership Moving.</em></h1><p>Capture incidents, assign corrective action, and ensure nothing falls through the cracks.</p></div>
        <blockquote>Great<br/>People Keep<br/>Great Adventures<br/>Rolling.</blockquote>
      </section>
      <OperationsIncidentManager tailored initialIncidents={data.incidents} persistence={data.persistence} initialError={data.error}/>
    </main> : <>
      <PageHeader eyebrow="Document and correct" title="Turn operational incidents into verified corrective action" description="Capture what happened, contain the risk, identify the cause, assign corrective work, and verify closure." action={<Link className="btn btn-ghost" href="/operations"><ArrowLeft size={16}/> Operations dashboard</Link>}/>
      <div className="callout operations-disclaimer"><Info size={20}/><div><strong>{shared ? "Protected incident register" : "Browser-local incident records"}</strong><p>{shared ? "Incident records are tenant-scoped, but this tool does not replace required regulatory, insurance, HR, or emergency reporting." : "This prototype does not replace required regulatory, insurance, human-resources, or emergency reporting."}</p></div></div>
      <OperationsIncidentManager initialIncidents={data.incidents} persistence={data.persistence} initialError={data.error}/>
    </>}
  </AppShell>;
}
