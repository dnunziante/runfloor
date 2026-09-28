import Link from "next/link";
import { BarChart3, ShieldCheck, TrendingUp, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OperationsIncidentManager } from "@/components/operations-incident-manager";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getOperationsWorkspace } from "@/lib/operations/repository";
import styles from "./incidents.module.css";

export default async function OperationsIncidentsPage() {
  const [data, viewer] = await Promise.all([getOperationsWorkspace(), getViewer()]);
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspaceName = viewer?.organizationName.trim().toLowerCase() || "";
  const isGolfCart = templateKey === "golf-cart" || workspaceName === "bgc dealerships";
  const tailoredExperience = Boolean(viewer && (isGolfCart || viewer.demo || workspaceName === "runfloor demo" || workspaceName === "rayne rv"));
  const isRv = templateKey === "rv" || workspaceName === "rayne rv" || (viewer?.demo && workspaceName === "runfloor rv");

  return <AppShell title="Incident Reports" industry={isRv ? "rv" : isGolfCart ? "golf-cart" : undefined}>
    {tailoredExperience ? <main className={`${styles.incidentExperience} ${isGolfCart ? styles.golfCart : styles.rv}`}>
      <section className={styles.hero} aria-labelledby="incident-page-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Operations reports</span>
          <h1 id="incident-page-title">Identify Issues. <em>Find Solutions.</em></h1>
          <p>Capture incidents, assign corrective action, and ensure nothing falls through the cracks.</p>
          <div className={styles.heroBenefits} aria-label="Incident reporting benefits">
            <span><ShieldCheck/><b>Keep your dealership safe<small>Report issues quickly</small></b></span>
            <span><UsersRound/><b>Drive accountability<small>Assign and track resolution</small></b></span>
            <span><BarChart3/><b>Stronger operations<small>Fewer repeat issues</small></b></span>
          </div>
        </div>
        <blockquote>{isGolfCart ? <>Problems<br/>Solved.<br/>People<br/>Empowered.</> : <>Great People.<br/>Safer Journeys.<br/>Stronger Teams.</>}</blockquote>
      </section>
      <OperationsIncidentManager tailored industry={isGolfCart ? "golf-cart" : isRv ? "rv" : "generic"} initialIncidents={data.incidents} persistence={data.persistence} initialError={data.error}/>
    </main> : <>
      <section className={styles.genericHeader}><span>Operations reports</span><h1>Identify Issues. <em>Find Solutions.</em></h1><p>Capture incidents, assign corrective action, and ensure nothing falls through the cracks.</p><Link href="/operations/performance"><TrendingUp/> View operations performance</Link></section>
      <OperationsIncidentManager initialIncidents={data.incidents} persistence={data.persistence} initialError={data.error}/>
    </>}
  </AppShell>;
}
