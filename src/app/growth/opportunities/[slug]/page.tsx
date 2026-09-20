import Link from "next/link";
import { ArrowLeft, Gauge, Timer, TrendingUp } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { GrowthActionPlan } from "@/components/growth-action-plan";
import { GrowthScoreBreakdown } from "@/components/growth-score-breakdown";
import { getGrowthOpportunity, growthOpportunities } from "@/lib/growth/data";
import { getGrowthPlan } from "@/lib/growth/plans";
import { getGrowthScoring } from "@/lib/growth/scoring";
import { getOrganizationLocations } from "@/lib/locations";

export function generateStaticParams() { return growthOpportunities.map(({ slug }) => ({ slug })); }

export default async function GrowthOpportunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const scoring = await getGrowthScoring();
  const opportunity = scoring.opportunities.find((item) => item.slug === slug) ?? getGrowthOpportunity(slug);
  if (!opportunity) notFound();
  const saved = await getGrowthPlan(opportunity.slug);
  const { locations } = await getOrganizationLocations();
  return <AppShell title="Growth Opportunity">
    <Link className="text-button growth-back" href="/growth"><ArrowLeft size={15}/> Back to opportunities</Link>
    <PageHeader eyebrow={opportunity.category} title={opportunity.title} description={opportunity.summary} />
    <div className="callout growth-disclaimer"><TrendingUp size={20}/><div><strong>Planning opportunity</strong><p>Validate this idea with customer, operational, and market information before acting on it.</p></div></div>
    <div className="grid grid-3 growth-detail-metrics"><div className="card"><span className="metric-icon"><TrendingUp size={18}/></span><small>Potential impact</small><strong>{opportunity.impact}</strong></div><div className="card"><span className="metric-icon"><Gauge size={18}/></span><small>Estimated effort</small><strong>{opportunity.effort}</strong></div><div className="card"><span className="metric-icon"><Timer size={18}/></span><small>Suggested window</small><strong>{opportunity.timeframe}</strong></div></div>
    <div className="growth-detail-grid"><section className="card"><h2>Why it may be worth exploring</h2><p>{opportunity.rationale}</p><h2>Suggested validation plan</h2><ol className="growth-action-list">{opportunity.actions.map((action, index) => <li key={action}><span>{index + 1}</span><div><strong>{action}</strong><small>Confirm the owner, evidence needed, and completion date.</small></div></li>)}</ol></section><aside className="form-stack"><div className="card"><h2>What to measure</h2><ul className="coach-check-list">{opportunity.measures.map((measure) => <li key={measure}>{measure}</li>)}</ul><p>Track owners, tasks, and results in the action plan below.</p></div></aside></div>
    <div className="section-heading"><h2>Why it ranks where it does</h2></div><GrowthScoreBreakdown score={opportunity.score} weights={scoring.weights}/>
    <div className="section-heading"><h2>Put the idea into action</h2></div>{saved.error && <div className="card error-card"><h2>Shared plan data unavailable</h2><p>{saved.error}</p></div>}<GrowthActionPlan opportunity={opportunity} initialPlan={saved.plan} persistence={saved.persistence} locations={locations}/>
    <div className="growth-detail-actions"><Link className="btn btn-ghost" href="/growth"><ArrowLeft size={16}/> View all opportunities</Link></div>
  </AppShell>;
}
