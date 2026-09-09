import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowRightLeft, Bell, BookOpenCheck, CalendarDays, Check, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, FileWarning, ListChecks, MapPin, Plus, Repeat2, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getOperationsWorkspace } from "@/lib/operations/repository";
import styles from "./operations-dashboard.module.css";

const quickActions = [
  ["View today’s checklists", "/operations/checklists", ClipboardCheck, "green"], ["Browse procedures", "/operations/procedures", BookOpenCheck, "orange"],
  ["Check operational alerts", "/operations/alerts", AlertTriangle, "red"], ["Open task calendar", "/operations/calendar", CalendarDays, "blue"],
  ["View handoff logs", "/operations/handoffs", ArrowRightLeft, "purple"], ["Report an incident", "/operations/incidents", FileWarning, "slate"],
] as const;
const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));

export default async function OperationsPage() {
  const data = await getOperationsWorkspace();
  const published = data.procedures.filter((item) => item.status === "Published");
  const activeChecklists = data.checklists.filter((item) => item.steps.some((step) => !step.complete));
  const openAlerts = data.alerts.filter((item) => item.status !== "Resolved");
  const completedSteps = data.checklists.reduce((sum, item) => sum + item.steps.filter((step) => step.complete).length, 0);
  const totalSteps = data.checklists.reduce((sum, item) => sum + item.steps.length, 0);
  const completion = totalSteps ? Math.round(completedSteps / totalSteps * 100) : 0;
  const upcoming = [...data.schedules].filter((item) => item.status === "Active").sort((a, b) => a.nextRunDate.localeCompare(b.nextRunDate)).slice(0, 3);
  const recent = [...data.procedures].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);

  return <AppShell title="Operations Assistant"><div className={styles.dashboard}>
    <section className={styles.hero}><div className={styles.heroCopy}><span className={styles.eyebrow}>Operations assistant</span><h1>Run Better Operations. Every Day.</h1><p>Keep every location aligned, consistent, and accountable.</p></div><div className={styles.heroMark} aria-hidden="true"><CheckCircle2/><span>Consistency<br/>creates freedom.</span></div></section>
    {data.error && <div className={styles.notice} role="status"><AlertTriangle size={18}/><span>{data.error}</span></div>}
    <section className={styles.metrics} aria-label="Operations overview">
      <Metric href="/operations/checklists" icon={CheckCircle2} tone="green" label="Today’s completion" value={`${completion}%`} detail={`${completedSteps} of ${totalSteps} steps`}/>
      <Metric href="/operations/checklists" icon={ListChecks} tone="blue" label="Active checklists" value={String(activeChecklists.length)} detail="Across your workspace"/>
      <Metric href="/operations/alerts" icon={AlertTriangle} tone="red" label="Needs attention" value={String(openAlerts.length)} detail="Review before completion"/>
      <Metric href="/operations/procedures" icon={BookOpenCheck} tone="purple" label="Procedures" value={String(published.length)} detail="Published guidance"/>
      <div className={`${styles.metricCard} ${styles.dateCard}`}><span className={`${styles.iconBox} ${styles.orange}`}><CalendarDays/></span><span><small>{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</small><em>Let’s keep things moving.</em><Link className={styles.newTask} href="/operations/checklists"><Plus/> New checklist</Link></span></div>
    </section>
    <div className={styles.pageGrid}><div className={styles.primaryColumn}>
      <section className={styles.panel}><Heading title="Quick Actions" subtitle="Get to what you need fast."/><div className={styles.quickGrid}>{quickActions.map(([label, href, Icon, tone]) => <Link href={href} className={`${styles.quickAction} ${styles[tone]}`} key={href}><Icon/><span>{label}</span></Link>)}</div></section>
      <section className={`${styles.panel} ${styles.checklistPanel}`}><div className={styles.tabs}><span className={styles.activeTab}>Today’s Checklists</span><Link href="/operations/handoffs">Handoff Logs</Link><Link href="/operations/schedules">Schedules</Link><Link href="/operations/calendar">Calendar</Link><Link className={styles.viewAll} href="/operations/checklists">View all <ArrowRight/></Link></div><Heading title="Today’s Checklists" subtitle="Stay on track with your operational responsibilities."/>
        {data.checklists.length === 0 ? <Empty/> : <div className={styles.tableWrap}><table><thead><tr><th>Checklist</th><th>Location</th><th>Owner</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.checklists.slice(0, 5).map((item) => { const done = item.steps.filter((step) => step.complete).length; const complete = item.steps.length > 0 && done === item.steps.length; const status = complete ? "Complete" : done ? "In progress" : "Not started"; return <tr key={item.id}><td><strong>{item.title}</strong><small>{done} of {item.steps.length} steps</small></td><td><span className={styles.location}><MapPin/>{item.location}</span></td><td>{item.owner}</td><td>{formatDate(item.dueDate)}</td><td><span className={`${styles.status} ${complete ? styles.statusComplete : done ? styles.statusProgress : ""}`}>{complete ? <Check/> : <Clock3/>}{status}</span></td><td><Link className={styles.rowAction} href="/operations/checklists">{complete ? "Review" : "Start"}<ChevronRight/></Link></td></tr>; })}</tbody></table></div>}
      </section>
      <section className={styles.panel}><Heading title="Featured Procedures" subtitle="Quick access to published guidance." action="Browse all" href="/operations/procedures"/><div className={styles.procedureGrid}>{published.slice(0, 5).map((procedure, index) => <Link href="/operations/procedures" className={styles.procedureCard} key={procedure.id}><span className={`${styles.iconBox} ${[styles.orange, styles.blue, styles.purple, styles.green][index % 4]}`}><BookOpenCheck/></span><span><strong>{procedure.title}</strong><small>{procedure.category}</small></span><em>View <ArrowRight/></em></Link>)}</div></section>
    </div><aside className={styles.sideColumn} aria-label="Operations updates">
      <section className={styles.panel}><Heading title="Operational Alerts" subtitle="Exceptions that may require follow-up." action="View all" href="/operations/alerts"/>{openAlerts.length === 0 ? <div className={`${styles.emptyState} ${styles.alertEmpty}`}><Bell/><strong>No active alerts</strong><span>You’re all caught up!</span></div> : <div className={styles.sideList}>{openAlerts.slice(0, 3).map((alert) => <Link href="/operations/alerts" key={alert.id}><span className={`${styles.iconBox} ${styles.red}`}><ShieldAlert/></span><span><strong>{alert.title}</strong><small>{alert.location} · {alert.severity}</small></span><ChevronRight/></Link>)}</div>}</section>
      <section className={styles.panel}><Heading title="Upcoming Tasks" action="View all" href="/operations/calendar"/>{upcoming.length === 0 ? <div className={styles.compactEmpty}>No active schedules.</div> : <div className={styles.sideList}>{upcoming.map((item) => <Link href="/operations/schedules" key={item.id}><span className={styles.dateTile}><small>{new Date(`${item.nextRunDate}T12:00:00`).toLocaleString("en-US", { month: "short" }).toUpperCase()}</small><strong>{new Date(`${item.nextRunDate}T12:00:00`).getDate()}</strong></span><span><strong>{item.procedureTitle}</strong><small>{item.location} · {item.frequency}</small></span><ChevronRight/></Link>)}</div>}</section>
      <section className={styles.panel}><Heading title="Recent Activity" action="View all" href="/operations/procedures"/><div className={styles.sideList}>{recent.map((item, index) => <Link href="/operations/procedures" key={item.id}><span className={`${styles.iconBox} ${[styles.blue, styles.green, styles.purple][index % 3]}`}><Repeat2/></span><span><strong>Procedure {item.status.toLowerCase()}</strong><small>{item.title} · v{item.version}</small></span><ChevronRight/></Link>)}</div></section>
    </aside></div>
  </div></AppShell>;
}

function Metric({ href, icon: Icon, tone, label, value, detail }: { href: string; icon: typeof CheckCircle2; tone: string; label: string; value: string; detail: string }) { return <Link href={href} className={styles.metricCard}><span className={`${styles.iconBox} ${styles[tone]}`}><Icon/></span><span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span><ChevronRight/></Link>; }
function Heading({ title, subtitle, action, href }: { title: string; subtitle?: string; action?: string; href?: string }) { return <div className={styles.sectionHeading}><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action && href && <Link className={styles.outlineButton} href={href}>{action}<ArrowRight/></Link>}</div>; }
function Empty() { return <div className={styles.emptyState}><ClipboardCheck/><strong>No checklists yet</strong><span>Create a checklist to start tracking recurring work.</span><Link href="/operations/checklists">Create checklist</Link></div>; }
