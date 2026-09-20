import { AppShell } from "@/components/app-shell";
import { AdaptiveCoachSession } from "@/components/adaptive-coach-session";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { BrainCircuit, ChartNoAxesColumnIncreasing, Target, Trophy } from "lucide-react";
import styles from "./session.module.css";

export default async function CoachSessionPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const initialMode = mode === "objection" || mode === "challenge" ? mode : "role_play";
  const viewer = await getViewer();
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspace = viewer?.organizationName.trim().toLowerCase() || "";
  const tailored = Boolean(viewer && (templateKey === "rv" || workspace === "runfloor demo" || workspace === "runfloor rv" || workspace === "rayne rv"));
  if (!tailored) return <AppShell title="Adaptive Role-Play"><PageHeader eyebrow="Dynamic customer simulation" title="Practice the conversation, not a script" description="The customer reacts to what you say. Their hidden situation and your next challenge are tailored to your saved coaching profile."/><AdaptiveCoachSession initialMode={initialMode}/></AppShell>;
  return <AppShell title="Adaptive Role-Play" industry="rv"><main className={styles.experience}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>Dynamic customer simulation</span><h1>Practice the<br/>conversation, <em>not a script.</em></h1><p>Real customers. Real reactions. Real preparation.</p><div className={styles.heroPoints}><span><BrainCircuit/>AI-Powered<br/>Conversations</span><span><ChartNoAxesColumnIncreasing/>Adapts to<br/>Your Skill Level</span><span><Target/>Realistic<br/>Customer Behavior</span><span><Trophy/>Build Confidence<br/>&amp; Close More Deals</span></div></div><blockquote>Same Roads.<br/>Bigger Opportunities.</blockquote></section>
    <AdaptiveCoachSession initialMode={initialMode} tailored/>
  </main></AppShell>;
}
