import { AppShell } from "@/components/app-shell";
import { GrowthPerformanceDashboard } from "@/components/growth-performance-dashboard";
import { getGrowthPlans } from "@/lib/growth/plans";
import styles from "./performance.module.css";

export default async function GrowthPerformancePage() {
  const data = await getGrowthPlans();
  return <AppShell title="Growth Performance">
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="performance-title">
        <p className={styles.kicker}>Measure execution</p>
        <h1 id="performance-title">See whether growth<br />plans <span>are moving.</span></h1>
        <p>Track ownership, deadlines, plan status, and real results for your RV dealership.</p>
      </section>
      <GrowthPerformanceDashboard initialPlans={data.plans} persistence={data.persistence} initialError={data.error} />
    </div>
  </AppShell>;
}
