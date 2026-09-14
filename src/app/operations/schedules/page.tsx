import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OperationsScheduleManager } from "@/components/operations-schedule-manager";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getOperationsWorkspace } from "@/lib/operations/repository";

export default async function OperationsSchedulesPage() {
  const viewer = await getViewer();
  const [data, industryTemplateKey] = await Promise.all([getOperationsWorkspace(), viewer ? getViewerIndustryTemplateKey(viewer) : Promise.resolve(null)]);
  const shared = data.persistence === "supabase";
  const isRv = industryTemplateKey === "rv";
  return <AppShell title="Recurring Schedules" industry={isRv ? "rv" : undefined}><main className={`rs-page${isRv ? " rv-rs-page" : ""}`}><section className="rs-hero"><div><span>Operations automation</span><h1>{isRv ? <>Keep Operations On Track<em>Scheduled. Consistent. Exceptional.</em></> : "Recurring Schedules"}</h1><p>{isRv ? "Automate repeatable tasks, ensure nothing gets missed, and keep your dealership running smoothly." : "Schedule repeatable operational checklists, assign ownership, and generate each occurrence with a clear due date."}</p></div>{isRv ? <blockquote>More Adventures<br/>Start Here.</blockquote> : <aside><CalendarDays/><div><strong>Keep your dealership running smoothly.</strong><small>{shared ? "Schedules are protected within this organization." : "Create each demo occurrence when the work is ready."}</small></div></aside>}<Link href="/operations">Operations dashboard <ArrowRight/></Link></section><OperationsScheduleManager initialSchedules={data.schedules} initialProcedures={data.procedures} persistence={data.persistence} initialError={data.error} canManage={data.canManage} isRv={isRv}/></main></AppShell>;
}
