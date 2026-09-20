import Link from "next/link";
import { ArrowRight, BarChart3, ClipboardList, Lightbulb, Target, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GrowthOpportunityBoard } from "@/components/growth-opportunity-board";
import { getGrowthScoring } from "@/lib/growth/scoring";
import styles from "./growth-home.module.css";

export default async function GrowthAdvisorPage() {
  const scoring = await getGrowthScoring();
  const opportunities = scoring.opportunities;
  const highImpact = opportunities.filter((item) => item.impact === "High").length;
  const ready = opportunities.filter((item) => item.status === "Ready to review").length;
  const areas = new Set(opportunities.map((item) => item.category)).size;
  return <AppShell title="Business Growth Advisor">
    <div className={styles.growthHome}>
      <section className={styles.hero} aria-labelledby="growth-title">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Business Growth Advisor</p>
          <h1 id="growth-title">Turn possibilities<br />into <span>focused action.</span></h1>
          <p className={styles.heroIntro}>Find, evaluate, and prioritize practical growth opportunities for your RV dealership.</p>
          <div className={styles.heroSteps} aria-label="Growth planning steps">
            <span><Lightbulb aria-hidden="true" /> Discover<br />new ideas</span>
            <span><BarChart3 aria-hidden="true" /> Compare<br />impact and effort</span>
            <span><Target aria-hidden="true" /> Validate<br />potential</span>
            <span><ClipboardList aria-hidden="true" /> Create<br />action plans</span>
          </div>
        </div>
        <div className={styles.heroQuote}>“Growth doesn’t happen by chance.<br />It happens by focus.”<small>— RunFloor</small></div>
      </section>
      <div className={styles.body}>
        <div className={styles.metrics} aria-label="Opportunity overview">
          <a href="#opportunity-board" className={styles.metric}><Lightbulb aria-hidden="true" /><span><strong>{opportunities.length}</strong><b>Opportunities</b><small>Across {areas} growth areas</small></span><ArrowRight aria-hidden="true" /></a>
          <a href="#opportunity-board" className={styles.metric}><Target aria-hidden="true" /><span><strong>{highImpact}</strong><b>High impact</b><small>Ideas to validate</small></span><ArrowRight aria-hidden="true" /></a>
          <a href="#opportunity-board" className={styles.metric}><BarChart3 aria-hidden="true" /><span><strong>{ready}</strong><b>Ready to review</b><small>Explore next steps</small></span><ArrowRight aria-hidden="true" /></a>
          <Link href="/growth/priorities" className={styles.metric}><TrendingUp aria-hidden="true" /><span><strong>{areas}</strong><b>Growth areas</b><small>Compare priority scores</small></span><ArrowRight aria-hidden="true" /></Link>
        </div>
        <section id="opportunity-board" aria-label="Opportunity board"><GrowthOpportunityBoard opportunities={opportunities} weights={scoring.weights} canEdit={scoring.canEdit} /></section>
        <p className={styles.sampleNote}>Priority scores are planning estimates. Validate demand, costs, and expected results before making business decisions.</p>
        {scoring.error && <p className={styles.error} role="alert">Opportunity data could not be refreshed: {scoring.error}</p>}
      </div>
    </div>
  </AppShell>;
}
