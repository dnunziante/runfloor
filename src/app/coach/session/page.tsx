import { AppShell } from "@/components/app-shell";
import { AdaptiveCoachSession } from "@/components/adaptive-coach-session";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { getCoachScenarios } from "@/lib/coach/data";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { BrainCircuit, ChartNoAxesColumnIncreasing, Target, Trophy } from "lucide-react";
import styles from "./session.module.css";

export default async function CoachSessionPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const initialMode = mode === "objection" || mode === "challenge" ? mode : "role_play";
  const viewer = await getViewer();
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspace = viewer?.organizationName.trim().toLowerCase() || "";
  const isGolfCart = templateKey === "golf-cart";
  const isRv = templateKey === "rv" || workspace === "runfloor demo" || workspace === "runfloor rv" || workspace === "rayne rv";
  const tailored = Boolean(viewer && (isGolfCart || isRv));
  if (!tailored) return <AppShell title="Adaptive Role-Play"><PageHeader eyebrow="Dynamic customer simulation" title="Practice the conversation, not a script" description="The customer reacts to what you say. Their hidden situation and your next challenge are tailored to your saved coaching profile."/><AdaptiveCoachSession initialMode={initialMode}/></AppShell>;
  const scenarioResult = isGolfCart ? await getCoachScenarios() : { scenarios: [] };
  return <AppShell title="Adaptive Role-Play" industry={isGolfCart ? "golf-cart" : "rv"}><main className={`${styles.experience} ${isGolfCart ? styles.golfCartExperience : ""}`}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>Dynamic customer simulation</span><h1>Practice the conversation,<br/><em>not a script.</em></h1><p>{isGolfCart ? "The customer reacts to what you say. Their hidden situation and next challenge are tailored to your saved coaching profile." : "Real customers. Real reactions. Real preparation."}</p><div className={styles.heroPoints}>{isGolfCart ? <><span><BrainCircuit/><b>Realistic customers</b><small>Dynamic, life-like responses</small></span><span><ChartNoAxesColumnIncreasing/><b>Personalized to you</b><small>Based on your development profile</small></span><span><Target/><b>Build real skills</b><small>Practice, get feedback, improve faster</small></span></> : <><span><BrainCircuit/>AI-Powered<br/>Conversations</span><span><ChartNoAxesColumnIncreasing/>Adapts to<br/>Your Skill Level</span><span><Target/>Realistic<br/>Customer Behavior</span><span><Trophy/>Build Confidence<br/>&amp; Close More Deals</span></>}</div></div><blockquote>{isGolfCart ? <>Real<br/>People.<br/>Real Scenarios.<br/>More Deals.</> : <>Same Roads.<br/>Bigger Opportunities.</>}</blockquote></section>
    <AdaptiveCoachSession initialMode={initialMode} tailored golfCart={isGolfCart} sampleScenarios={scenarioResult.scenarios}/>
  </main></AppShell>;
}
