import { BarChart3, ClipboardList, Target, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GrowthPlanList } from "@/components/growth-plan-list";
import { getGrowthPlans } from "@/lib/growth/plans";
import styles from "./plans.module.css";

export default async function GrowthPlansPage() {
  const data = await getGrowthPlans();
  return <AppShell title="Growth Action Plans">
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="plans-title">
        <p className={styles.kicker}>{data.persistence === "demo" ? "Local prototype" : "Shared workspace"}</p>
        <h1 id="plans-title">Keep growth work<br /><span>accountable.</span></h1>
        <p className={styles.heroIntro}>Turn opportunities into clear action plans, track progress, and make bigger things happen.</p>
        <div className={styles.heroSteps} aria-label="Action planning steps">
          <span><ClipboardList aria-hidden="true" />Set clear<br />next steps</span>
          <span><Target aria-hidden="true" />Assign<br />owners</span>
          <span><BarChart3 aria-hidden="true" />Track<br />progress</span>
          <span><Trophy aria-hidden="true" />Turn ideas<br />into results</span>
        </div>
      </section>
      <GrowthPlanList initialPlans={data.plans} persistence={data.persistence} initialError={data.error} />
    </div>
  </AppShell>;
}
