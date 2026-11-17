import { AppShell } from "@/components/app-shell";
import { AdminGrowthOpportunityManager } from "@/components/admin-growth-opportunity-manager";
import { PageHeader } from "@/components/page-header";
import { getAdminGrowthOpportunities } from "@/lib/growth/scoring";
export default async function AdminGrowthOpportunitiesPage(){const data=await getAdminGrowthOpportunities();return <AppShell title="Admin · Growth Opportunities"><PageHeader eyebrow="Workspace content" title="Manage this business’s growth opportunities" description="Create, edit, publish, and archive this workspace’s growth opportunities."/>{data.error&&<div className="card error-card"><p>{data.error}</p></div>}<AdminGrowthOpportunityManager initial={data.opportunities} persistence={data.persistence} canEdit={data.canEdit}/></AppShell>}
