import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OperationsScheduleManager } from "@/components/operations-schedule-manager";
import { getOperationsWorkspace } from "@/lib/operations/repository";

export default async function OperationsSchedulesPage() {
  const data = await getOperationsWorkspace(); const shared = data.persistence === "supabase";
  return <AppShell title="Recurring Schedules"><main className="rs-page"><section className="rs-hero"><div><span>Operations automation</span><h1>Recurring Schedules</h1><p>Schedule repeatable operational checklists, assign ownership, and generate each occurrence with a clear due date.</p></div><aside><CalendarDays/><div><strong>Keep your dealership running smoothly.</strong><small>{shared ? "Schedules are protected within this organization." : "Create each demo occurrence when the work is ready."}</small></div></aside><Link href="/operations">Operations dashboard <ArrowRight/></Link></section><OperationsScheduleManager initialSchedules={data.schedules} initialProcedures={data.procedures} persistence={data.persistence} initialError={data.error} canManage={data.canManage}/></main></AppShell>;
}
