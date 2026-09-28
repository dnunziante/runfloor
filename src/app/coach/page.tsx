import Link from "next/link";
import { ArrowRight, Award, BarChart3, BookOpen, CheckCircle2, ChevronRight, Clock3, GraduationCap, Lightbulb, MessageSquare, Play, Target, TrendingUp, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { getCoachDashboardData } from "@/lib/coach/data";
import { demoCloserScores } from "@/lib/coach/demo";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import styles from "./coach.module.css";

export default async function CoachDashboardPage() {
  const [data, viewer] = await Promise.all([getCoachDashboardData(), getViewer()]);
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspaceName = viewer?.organizationName.trim().toLowerCase() || "";
  const isGolfCart = templateKey === "golf-cart" || workspaceName === "bgc dealerships";
  const isRv = templateKey === "rv" || workspaceName === "rayne rv" || (viewer?.demo && workspaceName === "runfloor rv");
  const tailored = Boolean(viewer && (isGolfCart || isRv || viewer.demo || workspaceName === "runfloor demo"));
  const scores = data.recentSessions[0]?.closerScores.length ? data.recentSessions[0].closerScores : data.source === "demo" ? demoCloserScores : [];

  if (tailored) return <AppShell title="Sales Coach" industry={isGolfCart ? "golf-cart" : isRv ? "rv" : undefined}>
    <main className={`${styles.coachExperience} ${isGolfCart ? styles.golfCart : styles.rv}`}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}><span className={styles.eyebrow}>Sales coach</span><h1>Build confidence<br/><em>one conversation</em><br/>at a time.</h1><p>Practice. Learn. Get feedback. Close more deals.</p><div className={styles.heroBenefits}><span><MessageSquare/><b>Real conversations</b><small>Practice with real-world scenarios.</small></span><span><BarChart3/><b>Track your progress</b><small>See measurable improvement.</small></span><span><Trophy/><b>More closed deals</b><small>Build confidence and win.</small></span></div></div>
        <div className={styles.heroAction}><blockquote>Great<br/>Conversations<br/>Lead To<br/>Great<br/>Adventures.</blockquote><Link className="btn btn-primary" href="/coach/scenarios"><Play/> Start Practice <ArrowRight/></Link></div>
      </section>
      <div className={styles.content}>
        {data.error && <div className="card error-card"><h2>Coach data unavailable</h2><p>{data.error}</p></div>}
        <section className={styles.metrics} aria-label="Sales coaching summary">
          <Metric tone="orange" label="Practice sessions" value={String(data.practiceSessions)} copy="Completed sessions" icon={<MessageSquare/>}/>
          <Metric tone="blue" label="Available scenarios" value={String(data.scenarios.length)} copy="Across published practice" icon={<BookOpen/>}/>
          <Metric tone="green" label="Average score" value={data.averageScore===null?"—":`${data.averageScore}%`} copy={data.averageScore===null?"Complete a session":"Across saved sessions"} icon={<Target/>}/>
          <Metric tone="purple" label="Recent activity" value={String(data.recentSessions.length)} copy="Reviewable sessions" icon={<TrendingUp/>}/>
        </section>

        <section className={styles.primaryGrid}>
          <div className={`${styles.panel} ${styles.scenarios}`}><PanelHeader icon={<Play/>} title="Popular Practice Scenarios" copy="Real-world conversations. Real results." href="/coach/scenarios" label="View all"/><div className={styles.scenarioGrid}>{data.scenarios.slice(0,4).map((scenario,index)=><article className={styles.scenarioCard} key={scenario.id}><div className={styles.scenarioImage} data-position={index}><span>{scenario.category}</span></div><div><h3>{scenario.title}</h3><p>{scenario.goal}</p><small><Clock3/> {scenario.duration}</small><Link className="btn btn-ghost" href={`/coach/session?scenario=${scenario.slug}`}>Start Practice</Link></div></article>)}</div>{!data.scenarios.length&&<EmptyState icon={<Target/>} title="No scenarios available" copy="A workspace administrator can publish the first practice scenario." href="/coach/scenarios"/>}</div>
          <div className={`${styles.panel} ${styles.skills}`}><PanelHeader title="C.L.O.S.E.R. Skill Profile" copy="See how your skills measure up and where to focus next." href="/coach/review" label="View report"/><div className={styles.scoreList}>{scores.length?scores.map(([skill,score],index)=><div key={skill}><i data-tone={index%4}>{skill.charAt(0)}</i><span>{skill}</span><div><b style={{width:`${score}%`}}/></div><strong>{score}%</strong></div>):<div className={styles.noScores}><Award/><strong>Your skill profile is ready to grow</strong><p>Complete a practice session to build your C.L.O.S.E.R. profile.</p></div>}</div></div>
        </section>

        <section className={styles.secondaryGrid}>
          <div className={`${styles.panel} ${styles.recent}`}><PanelHeader icon={<GraduationCap/>} title="Recent Practice Sessions" copy="Review your latest sessions and see how you're improving." href="/coach/review" label="View all"/>{data.recentSessions.length?<div className={styles.sessionTable}><div><b>Date</b><b>Scenario</b><b>Score</b><b>Feedback</b><b>Actions</b></div>{data.recentSessions.map((session)=><div key={session.id}><time dateTime={session.completedAt}>{formatDate(session.completedAt)}</time><strong>{session.scenarioTitle}</strong><b>{session.score}%</b><span className={session.score>=80?styles.good:session.score>=65?styles.progress:styles.focus}>{session.score>=80?<CheckCircle2/>:<Lightbulb/>}{session.score>=80?"Strong session":session.score>=65?"Keep building":"Focus area"}</span><Link href={`/coach/review?session=${session.id}`}><Play/> Review</Link></div>)}</div>:<EmptyState icon={<Clock3/>} title="No recent practice yet" copy="Complete a scenario and your review history will appear here." href="/coach/scenarios"/>}</div>
          <div className={`${styles.panel} ${styles.goals}`}><PanelHeader icon={<Trophy/>} title="Your Coaching Goals" copy="Set goals, track progress, and keep leveling up." href="/coach/development" label="Edit goals"/><div className={styles.goalList}><Goal icon={<Target/>} label="Reach 80% average score" value={data.averageScore??0} meta={`${data.averageScore??0}% / 80%`}/><Goal icon={<BarChart3/>} label="Complete 10 practice sessions" value={Math.min(100,data.practiceSessions*10)} meta={`${Math.min(data.practiceSessions,10)} / 10`}/><Goal icon={<MessageSquare/>} label="Build C.L.O.S.E.R. consistency" value={scores.length?Math.round(scores.reduce((sum,[,score])=>sum+score,0)/scores.length):0} meta={scores.length?"Profile active":"Start practicing"}/></div></div>
        </section>
      </div>
    </main>
  </AppShell>;

  return <AppShell title="Sales Coach"><PageHeader eyebrow="Practice with purpose" title="Build confidence one conversation at a time" description="Use structured practice scenarios and C.L.O.S.E.R.-based coaching to sharpen the skills that matter most." action={<Link className="btn btn-primary" href="/coach/scenarios"><Play size={16}/> Start practice</Link>}/><div className="grid grid-4"><Metric label="Practice sessions" value={String(data.practiceSessions)} copy="Saved sessions" icon={<MessageSquare/>}/><Metric label="Available scenarios" value={String(data.scenarios.length)} copy="Published practice" icon={<Award/>}/><Metric label="Average score" value={data.averageScore===null?"—":`${data.averageScore}%`} copy="Saved performance" icon={<TrendingUp/>}/><Metric label="Recent activity" value={String(data.recentSessions.length)} copy="Reviewable sessions" icon={<Clock3/>}/></div></AppShell>;
}

function Metric({label,value,copy,icon,tone}:{label:string;value:string;copy:string;icon:React.ReactNode;tone?:string}){return <div className={`card ${styles.metricCard}`} data-tone={tone}><span className={styles.metricIcon}>{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{copy}</small></div><ChevronRight/></div>}
function PanelHeader({icon,title,copy,href,label}:{icon?:React.ReactNode;title:string;copy:string;href:string;label:string}){return <header className={styles.panelHeader}><div>{icon&&<span>{icon}</span>}<div><h2>{title}</h2><p>{copy}</p></div></div><Link href={href}>{label} <ArrowRight/></Link></header>}
function EmptyState({icon,title,copy,href}:{icon:React.ReactNode;title:string;copy:string;href:string}){return <div className={styles.empty}>{icon}<h3>{title}</h3><p>{copy}</p><Link className="btn btn-primary" href={href}>Explore practice <ArrowRight/></Link></div>}
function Goal({icon,label,value,meta}:{icon:React.ReactNode;label:string;value:number;meta:string}){return <div><i>{icon}</i><span><strong>{label}</strong><span><b style={{width:`${Math.min(100,value)}%`}}/></span></span><em>{meta}</em></div>}
function formatDate(value:string){return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(value))}
