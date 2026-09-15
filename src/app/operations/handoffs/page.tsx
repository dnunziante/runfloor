import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OperationsHandoffManager } from "@/components/operations-handoff-manager";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getOperationsWorkspace } from "@/lib/operations/repository";
import styles from "./handoffs.module.css";

export default async function OperationsHandoffsPage() {
  const [data, viewer] = await Promise.all([getOperationsWorkspace(), getViewer()]);
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspaceName = viewer?.organizationName.trim().toLowerCase() || "";
  const tailoredExperience = Boolean(viewer && (templateKey === "golf-cart" || viewer.demo || workspaceName === "runfloor demo" || workspaceName === "rayne rv"));
  const isRv = templateKey === "rv" || workspaceName === "rayne rv" || (viewer?.demo && workspaceName === "runfloor rv");
  const shared = data.persistence === "supabase";

  return <AppShell title="Operations Handoffs" industry={isRv ? "rv" : undefined}>
    {tailoredExperience ? <main className={styles.handoffExperience}>
      <section className={styles.hero}>
        <div><span className={styles.eyebrow}>Operations handoffs</span><h1>A Smooth Handoff<br/><em>Keeps Us Rolling.</em></h1><p>Share key updates, open items, and next steps so every team member is set up for success.</p></div>
        <blockquote>Same Team.<br/>Next Shift.<br/>Bigger Journeys.</blockquote>
      </section>
      <OperationsHandoffManager tailored initialHandoffs={data.handoffs} persistence={data.persistence} initialError={data.error}/>
    </main> : <>
      <PageHeader eyebrow="Carry context forward" title="Make every shift change clear and accountable" description="Record what happened, what remains unresolved, what was decided, and who owns the next action." action={<Link className="btn btn-ghost" href="/operations"><ArrowLeft size={16}/> Operations dashboard</Link>}/>
      <div className="callout operations-disclaimer"><Info size={20}/><div><strong>{shared ? "Protected handoff history" : "Browser-local handoffs"}</strong><p>{shared ? "Handoffs are shared only with authorized members of this organization." : "These prototype handoff logs are saved only in this browser and are not sent to employees or other locations."}</p></div></div>
      <OperationsHandoffManager initialHandoffs={data.handoffs} persistence={data.persistence} initialError={data.error}/>
    </>}
  </AppShell>;
}
