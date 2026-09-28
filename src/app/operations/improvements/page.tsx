import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, ChevronRight, Clock3, Lightbulb, Plus, UserRound, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ImprovementHub } from "@/components/improvement-hub";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getImprovementWorkspace } from "@/lib/operations/improvement-repository";
import styles from "./improvements.module.css";

export default async function ImprovementsPage() {
  const [data, viewer] = await Promise.all([getImprovementWorkspace(), getViewer()]);
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspaceName = viewer?.organizationName.trim().toLowerCase() || "";
  const isGolfCart = templateKey === "golf-cart" || workspaceName === "bgc dealerships";
  const tailored = Boolean(viewer && (isGolfCart || viewer.demo || workspaceName === "runfloor demo" || workspaceName === "rayne rv"));
  const isRv = templateKey === "rv" || workspaceName === "rayne rv" || (viewer?.demo && workspaceName === "runfloor rv");
  const items = data.items;
  const open = items.filter((item) => !["Verified", "Closed"].includes(item.status)).length;
  const review = items.filter((item) => item.managerDecision === "Pending").length;
  const verified = items.filter((item) => ["Verified", "Closed"].includes(item.status)).length;

  if (tailored) return <AppShell title="Help Us Improve" industry={isRv ? "rv" : isGolfCart ? "golf-cart" : undefined}><main className={`${styles.improvementExperience} ${isGolfCart ? styles.golfCart : styles.rv}`}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>Process improvement</span><h1>Small Ideas.<br/><em>A Smoother Journey.</em></h1><p>Help us find what&apos;s working, what&apos;s not, and how we can make RunFloor an even better road for our team and customers.</p></div><blockquote>{isGolfCart ? <>Better<br/>People.<br/>Better<br/>Experiences.</> : <>Better Teams.<br/>Better Journeys.<br/>Every Day.</>}</blockquote></section>
    <div className={styles.content}>
      {data.error && <p className="form-error">{data.error}</p>}
      <section className={styles.metrics}><Metric label="Open submissions" value={open} copy="Still moving through review or action" icon={<Lightbulb/>} tone="orange"/><Metric label="Waiting for review" value={review} copy="Ready for a manager decision" icon={<Clock3/>} tone="blue"/><Metric label="Verified improvements" value={verified} copy="Results confirmed and closed" icon={<CheckCircle2/>} tone="green"/><Metric label="Team participation" value={new Set(items.map((item)=>item.submittedBy)).size} copy="Team members shared ideas" icon={<UsersRound/>} tone="purple"/></section>
      <ImprovementHub items={items} persistence={data.persistence} canManage={data.canManage}/>
    </div>
  </main></AppShell>;

  return <AppShell title="Help Us Improve"><PageHeader eyebrow="Process improvement" title="Small observations can create meaningful change" description="Report a problem, suggest an improvement, and follow what happens next." action={<Link className="btn btn-primary" href="/operations/improvements/new"><Plus size={16}/> Help us improve</Link>}/><div className="callout operations-disclaimer"><Lightbulb size={20}/><div><strong>Simple employee experience</strong><p>Describe what you noticed in everyday language. Managers will handle the improvement-method terminology and review steps.</p></div></div>{data.error && <p className="form-error">{data.error}</p>}<section className="grid grid-3"><Metric label="Open submissions" value={open} copy="Still moving through review or action" icon={<Clock3/>}/><Metric label="Waiting for review" value={review} copy="Ready for a manager decision" icon={<UserRound/>}/><Metric label="Verified improvements" value={verified} copy="Results confirmed and closed" icon={<CheckCircle2/>}/></section>{data.canManage && <div className="improvement-page-actions"><Link className="btn btn-secondary" href="/operations/improvements/review"><UserRound size={16}/> Manager review</Link><Link className="btn btn-ghost" href="/operations/improvements/dashboard"><BarChart3 size={16}/> Improvement dashboard</Link></div>}{items.length ? <section className="improvement-list" aria-label="Improvement submissions">{items.map((item)=><article className="card improvement-list-card" key={item.id}><div className="metric-row"><span className="badge">{item.status}</span><small>{new Date(item.submittedAt).toLocaleDateString()}</small></div><h2>{item.title}</h2><p>{item.description}</p><Link className="text-button" href={`/operations/improvements/${item.id}`}>View progress <ArrowRight size={14}/></Link></article>)}</section>:<section className="card output empty"><div><Lightbulb size={28}/><h2>No submissions yet</h2><p>Report the first problem or improvement idea for your location.</p><Link className="btn btn-primary" href="/operations/improvements/new">Help us improve</Link></div></section>}</AppShell>;
}

function Metric({label,value,copy,icon,tone="orange"}:{label:string;value:number;copy:string;icon:React.ReactNode;tone?:string}) { return <div className={`card ${styles.metricCard}`} data-tone={tone}><span className="metric-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{copy}</small></div><ChevronRight/></div>; }
