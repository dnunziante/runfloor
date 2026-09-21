import { AppShell } from "@/components/app-shell";
import { AdminGrowthScoringEditor } from "@/components/admin-growth-scoring-editor";
import { getGrowthScoring } from "@/lib/growth/scoring";
import styles from "./scoring.module.css";

export default async function AdminGrowthPage() {
  const data = await getGrowthScoring();
  return <AppShell title="Admin · Growth Scoring">
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="admin-growth-title">
        <p className={styles.kicker}>Tenant configuration</p>
        <h1 id="admin-growth-title">Set how this business<br /><span>prioritizes growth.</span></h1>
        <p>Adjust formula weights and opportunity ratings while keeping every result deterministic and explainable.</p>
        <blockquote>“The right focus today builds a bigger tomorrow.”<small>— RunFloor</small></blockquote>
      </section>
      {data.error && <div className={styles.error} role="alert"><strong>Scoring configuration unavailable</strong><p>{data.error}</p></div>}
      <AdminGrowthScoringEditor opportunities={data.opportunities} initialWeights={data.weights} persistence={data.persistence} canEdit={data.canEdit} />
    </div>
  </AppShell>;
}
