import Link from "next/link";
import { ArrowRight, BarChart3, Compass, Lightbulb, Settings, ShieldAlert, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GrowthPriorityTable } from "@/components/growth-priority-table";
import { getGrowthScoring } from "@/lib/growth/scoring";
import styles from "./priorities.module.css";

export default async function GrowthPrioritiesPage() {
  const scoring = await getGrowthScoring();
  const weights = scoring.weights;
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  return <AppShell title="Growth Priority Scoring">
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="priority-title">
        <p className={styles.kicker}>Transparent prioritization</p>
        <h1 id="priority-title">Compare opportunities<br /><span>using the same rules.</span></h1>
        <p>Make smarter decisions. Focus on what drives growth for your RV dealership.</p>
      </section>
      <div className={styles.body}>
        <section className={styles.factorGrid} aria-label="How scoring works">
          <div className={`${styles.factorCard} ${styles.positive}`}><Trophy aria-hidden="true" /><div><h2>Positive factors</h2><p>Impact, confidence, alignment</p><small>Higher ratings increase priority.</small></div><BarChart3 aria-hidden="true" /></div>
          <div className={`${styles.factorCard} ${styles.constraint}`}><ShieldAlert aria-hidden="true" /><div><h2>Constraint factors</h2><p>Effort, cost, risk</p><small>Lower ratings increase priority.</small></div><BarChart3 aria-hidden="true" /></div>
          <div className={`${styles.factorCard} ${styles.weighting}`}><Settings aria-hidden="true" /><div><h2>Current weighting</h2><p><strong>{totalWeight} points total</strong></p><small>Impact {weights.impact}% · Confidence {weights.confidence}% · Alignment {weights.alignment}% · Effort {weights.effort}% · Cost {weights.cost}% · Risk {weights.risk}%</small></div></div>
          <div className={`${styles.factorCard} ${styles.tip}`}><Lightbulb aria-hidden="true" /><div><h2>Pro tip</h2><p>Use consistent ratings to compare ideas objectively.</p></div></div>
        </section>
        {scoring.error && <p className={styles.error} role="alert">Scoring data could not be refreshed: {scoring.error}</p>}
        <GrowthPriorityTable opportunities={scoring.opportunities} weights={weights} canEdit={scoring.canEdit} />
        <section className={styles.bottomGrid} aria-label="Next steps">
          <div className={styles.nextCard}><BarChart3 aria-hidden="true" /><div><h2>Next steps</h2><ul><li>Review the top opportunities</li><li>Validate assumptions with real data</li><li>Create an action plan</li></ul></div></div>
          <div className={styles.quoteCard}>“Focus turns possibilities<br />into progress.”<small>— RunFloor</small></div>
          <div className={styles.exploreCard}><Compass aria-hidden="true" /><div><h2>Explore more</h2><p>Browse growth opportunities or adjust how your team scores them.</p><div><Link href="/growth">Browse opportunities <ArrowRight size={15} /></Link>{scoring.canEdit && <Link href="/admin/growth">Scoring settings <Settings size={15} /></Link>}</div></div></div>
        </section>
        <details className={styles.formula}><summary>How the priority score is calculated</summary><p>Each factor is rated from 1 to 5. Impact, confidence, and alignment use their rating directly. Effort, cost, and risk are reversed so lower constraints improve the result. The configured weights should total 100.</p><code>Priority = weighted positive factors + weighted inverse constraints, divided by 5</code><p>These scores are planning aids, not predictions or verified financial estimates.</p></details>
      </div>
    </div>
  </AppShell>;
}
