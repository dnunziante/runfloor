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
  const isGolfCart = templateKey === "golf-cart";
  const isRv = templateKey === "rv" || workspace === "runfloor demo" || workspace === "runfloor rv" || workspace === "rayne rv";
  const tailored = Boolean(viewer && (isGolfCart || isRv));
  if (!tailored) return <LegacyRolePlay/>;

  const data = await getCoachDashboardData();
  return <AppShell title="Role Play" industry={isGolfCart ? "golf-cart" : "rv"}><main className={`${styles.experience} ${isGolfCart ? styles.golfCartExperience : ""}`}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>Practice studio</span><h1>Build confidence<br/><em>before the customer arrives.</em></h1><p>{isGolfCart ? "Work through realistic dealership conversations and receive simulated coaching to sharpen your skills and close more deals." : "Real conversations. Real practice. Real results."}</p><div className={styles.heroPoints}>{isGolfCart ? <><span><b>Real scenarios</b><small>Based on actual dealership conversations</small></span><span><b>Build your skills</b><small>Practice, get feedback, improve faster</small></span><span><b>Be ready</b><small>Walk into every customer conversation with confidence</small></span></> : <><span>Practice<br/>Real Scenarios</span><span>Sharpen<br/>Your Skills</span><span>Get Ready<br/>for the Sale</span><span>Be the Pro<br/>Your Customers Trust</span></>}</div></div><blockquote>{isGolfCart ? <>Practice<br/>Today.<br/>Close<br/>Tomorrow.</> : <>Same Roads.<br/>Bigger Possibilities.</>}</blockquote></section>
    {data.error && <div className="card error-card"><h2>Practice unavailable</h2><p>{data.error}</p></div>}
    <TailoredRolePlay scenarios={data.scenarios} sessionCount={data.practiceSessions} averageScore={data.averageScore} canManage={viewer?.role === "tenant_admin" || viewer?.role === "platform_owner"} golfCart={isGolfCart}/>
  </main></AppShell>;
}
