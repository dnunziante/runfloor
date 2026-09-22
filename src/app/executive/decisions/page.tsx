import { AlertTriangle, CheckCircle2, ClipboardList, Scale, TimerReset } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExecutiveDecisionLog } from "@/components/executive-decision-log";
import { RvDecisionPage } from "@/components/rv-decision-page";
import { PageHeader } from "@/components/page-header";
import { ReportingPeriodSelector } from "@/components/reporting-period-selector";
import { getViewer } from "@/lib/auth/viewer";
import { getExecutiveDecisions } from "@/lib/executive/decision-repository";
import { getExecutiveWorkspace } from "@/lib/executive/repository";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const [data, workspace, viewer] = await Promise.all([getExecutiveDecisions(period), getExecutiveWorkspace(period), getViewer()]);
  if (!data.canView || !viewer) redirect("/dashboard");
  const templateKey = await getViewerIndustryTemplateKey(viewer);
  const workspaceName = viewer.organizationName.trim().toLowerCase();
  const tailored = templateKey === "rv" || workspaceName === "runfloor demo" || workspaceName === "rayne rv";
  const priorities = workspace.priorities.map((priority) => ({ id: priority.id, title: priority.title }));
  if (tailored) return <AppShell title="Leadership Decisions" industry="rv"><RvDecisionPage data={data} priorities={priorities}/></AppShell>;

  const cards = [["Recorded decisions", data.summary.total, ClipboardList], ["Open decisions", data.summary.open, Scale], ["Validated outcomes", data.summary.validated, CheckCircle2], ["Due for review", data.summary.dueForReview, TimerReset]] as const;
  return <AppShell title="Leadership Decisions"><PageHeader eyebrow="Executive Advisor" title="Remember why a decision was made—and whether it worked" description="Connect leadership decisions to priorities, ownership, expected outcomes, and measured results."/>{data.error && <p className="form-error"><AlertTriangle size={15}/>{data.error}</p>}<ReportingPeriodSelector action="/executive/decisions" periods={data.availablePeriods} selected={data.reportingPeriod} label="Decision period"/><section className="grid grid-4 executive-metrics" aria-label="Decision summary">{cards.map(([label, value, Icon]) => <article className="card" key={label}><div className="metric-row"><span>{label}</span><span className="metric-icon"><Icon size={18}/></span></div><div className="metric">{value}</div></article>)}</section><ExecutiveDecisionLog initialDecisions={data.decisions} period={data.reportingPeriod} priorities={priorities} persistence={data.persistence}/></AppShell>;
}
