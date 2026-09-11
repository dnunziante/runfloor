import { CheckCircle2, ClipboardCheck, Clock3, ListTodo } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OperationsChecklistWorkspace } from "@/components/operations-checklist-workspace";
import { getOperationsWorkspace } from "@/lib/operations/repository";

export default async function OperationsChecklistsPage() {
  const data = await getOperationsWorkspace();
  const today = new Date().toISOString().slice(0, 10);
  const completed = data.checklists.filter((item) => item.steps.length > 0 && item.steps.every((step) => step.complete)).length;
  const inProgress = data.checklists.filter((item) => { const done = item.steps.filter((step) => step.complete).length; return done > 0 && done < item.steps.length; }).length;
  const overdue = data.checklists.filter((item) => item.dueDate < today && item.steps.some((step) => !step.complete)).length;
  const metrics = [
    { label: "Total checklists", value: data.checklists.length, detail: "Across this workspace", icon: ClipboardCheck, tone: "orange" },
    { label: "In progress", value: inProgress, detail: "Active operational work", icon: ListTodo, tone: "orange" },
    { label: "Completed", value: completed, detail: "Every step finished", icon: CheckCircle2, tone: "green" },
    { label: "Overdue", value: overdue, detail: overdue ? "Needs attention" : "Nothing overdue", icon: Clock3, tone: "red" },
  ];
  return <AppShell title="Operations Checklists">
    <section className="checklist-hero">
      <div className="checklist-hero-copy"><span>Assign and complete the work</span><h1>Turn repeatable operations into <em>visible progress.</em></h1><p>Create location-based checklists, assign owners and due dates, and mark each operational step complete.</p></div>
      <blockquote>“A well-run dealership runs on consistent execution.”</blockquote>
      <div className="checklist-metrics">{metrics.map(({ label, value, detail, icon: Icon, tone }) => <article className={`checklist-metric ${tone}`} key={label}><Icon/><div><strong>{value}</strong><span>{label}</span><small>{detail}</small></div></article>)}</div>
    </section>
    <OperationsChecklistWorkspace initialChecklists={data.checklists} initialProcedures={data.procedures} persistence={data.persistence} initialError={data.error}/>
  </AppShell>;
}
