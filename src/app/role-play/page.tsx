import { AppShell } from "@/components/app-shell";
import { LegacyRolePlay } from "@/components/legacy-role-play";
import { TailoredRolePlay } from "@/components/tailored-role-play";
import { getViewer } from "@/lib/auth/viewer";
import { getCoachDashboardData } from "@/lib/coach/data";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import styles from "./role-play.module.css";

export default async function RolePlayPage() {
  const viewer = await getViewer();
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspace = viewer?.organizationName.trim().toLowerCase() || "";
  const tailored = Boolean(viewer && (templateKey === "rv" || workspace === "runfloor demo" || workspace === "runfloor rv" || workspace === "rayne rv"));
  if (!tailored) return <LegacyRolePlay/>;

  const data = await getCoachDashboardData();
  return <AppShell title="Role Play" industry="rv"><main className={styles.experience}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>Practice studio</span><h1>Build confidence<br/><em>before the customer arrives.</em></h1><p>Real conversations. Real practice. Real results.</p><div className={styles.heroPoints}><span>Practice<br/>Real Scenarios</span><span>Sharpen<br/>Your Skills</span><span>Get Ready<br/>for the Sale</span><span>Be the Pro<br/>Your Customers Trust</span></div></div><blockquote>Same Roads.<br/>Bigger Possibilities.</blockquote></section>
    {data.error && <div className="card error-card"><h2>Practice unavailable</h2><p>{data.error}</p></div>}
    <TailoredRolePlay scenarios={data.scenarios} sessionCount={data.practiceSessions} averageScore={data.averageScore} canManage={viewer?.role === "tenant_admin" || viewer?.role === "platform_owner"}/>
  </main></AppShell>;
}
