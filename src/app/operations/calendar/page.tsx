import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OperationsTaskCalendar } from "@/components/operations-task-calendar";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getOperationsWorkspace } from "@/lib/operations/repository";
import styles from "./calendar.module.css";

export default async function OperationsCalendarPage() {
  const [data, viewer] = await Promise.all([getOperationsWorkspace(), getViewer()]);
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspaceName = viewer?.organizationName.trim().toLowerCase() || "";
  const tailoredExperience = Boolean(viewer && (
    templateKey === "golf-cart"
    || viewer.demo
    || workspaceName === "runfloor demo"
    || workspaceName === "rayne rv"
  ));
  const isRv = templateKey === "rv" || workspaceName === "rayne rv" || (viewer?.demo && workspaceName === "runfloor rv");
  const shared = data.persistence === "supabase";
  return <AppShell title="Operations Calendar" industry={isRv ? "rv" : undefined}>
    <main className={tailoredExperience ? styles.calendarExperience : undefined}>
      <PageHeader eyebrow="See the work by date" title="Keep scheduled, active, and overdue operations visible" description="Review checklist deadlines, alert due dates, and recurring schedule runs in one monthly view." action={<Link className="btn btn-ghost" href="/operations"><ArrowLeft size={16}/> Operations dashboard</Link>}/>
      <div className="callout operations-disclaimer"><Info size={20}/><div><strong>{shared ? "Shared Operations calendar" : "Browser-local calendar"}</strong><p>{shared ? "This calendar combines tenant-scoped checklists, alerts, and schedules. Employee calendar sync and notifications are not connected yet." : "This calendar reflects only sample and locally saved Operations records. It is not connected to employee calendars or notifications."}</p></div></div>
      <OperationsTaskCalendar tailored={tailoredExperience} initialChecklists={data.checklists} initialAlerts={data.alerts} initialSchedules={data.schedules} persistence={data.persistence} initialError={data.error}/>
    </main>
  </AppShell>;
}
