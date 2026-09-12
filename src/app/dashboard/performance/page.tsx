import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, BarChart3, Bot, CheckCircle2, Clock3, GraduationCap, Mail, MessageSquare, Play, Star, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getDashboardData } from "@/lib/dashboard/data";

function Selector({ label, name, value, options, hidden = {} }: { label: string; name: string; value?: string; options: { id: string; name: string }[]; hidden?: Record<string, string | undefined> }) {
  return <form action="/dashboard/performance" method="get" className="dashboard-selector">{Object.entries(hidden).map(([key, entry]) => entry ? <input key={key} type="hidden" name={key} value={entry}/> : null)}<label><span className="sr-only">{label}</span><select className="input" name={name} defaultValue={value}>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><button className="btn btn-secondary" type="submit">View</button></form>;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{view?:string;locationId?:string;employeeId?:string}> }) {
  const data = await getDashboardData(await searchParams);
  const employees = [{ id: "team-overview", name: "Team — all store statistics" }, ...data.employees.map((employee) => ({ id: employee.id, name: employee.name }))];
  const person = data.scope === "employee" ? data.employees[0]?.name.split(" ")[0] : undefined;
  const cards = [
    { label: "Questions answered", value: data.metrics.questions, Icon: Bot },
    { label: "Messages created", value: data.metrics.messages, Icon: Mail },
    { label: "Training completed", value: `${data.metrics.training}%`, Icon: GraduationCap },
    { label: "Team confidence", value: `${data.metrics.confidence} / 5`, Icon: Star },
  ];
  const progress = [
    { label: "Questions answered", value: data.metrics.questions, width: Math.min(data.metrics.questions, 100), Icon: MessageSquare, href: "/assistant" },
    { label: "Messages created", value: data.metrics.messages, width: Math.min(data.metrics.messages * 2, 100), Icon: Mail, href: "/email" },
    { label: "Training complete", value: `${data.metrics.training}%`, width: data.metrics.training, Icon: GraduationCap, href: "/training" },
  ];

  return <AppShell title={data.team ? "Team Dashboard" : "Personal Dashboard"}>
    <main className="personal-command">
      <section className="personal-hero" aria-labelledby="performance-title">
        <div><span>{data.team ? "Team performance" : "Personal performance"}</span><h1 id="performance-title">{person ? <>Good morning, {person}! <i aria-hidden="true">👋</i></> : data.title}</h1><p>{data.subtitle}</p></div>
        <blockquote>“Small steps<br/>create big results.”<small>— RunFloor</small></blockquote>
        <strong>Learn.<br/>Apply.<br/>Close.<br/><em>Grow.</em></strong>
      </section>

      {data.team && <section className="personal-controls" aria-label="Dashboard view controls"><Link className={data.scope === "company" ? "active" : ""} href="/dashboard/performance?view=company">Company</Link><Selector label="Location" name="locationId" value={data.selectedLocation} options={data.locations} hidden={{ view: "location" }}/><Selector label="Employee" name="employeeId" value={data.selectedEmployee} options={employees} hidden={{ view: "employee", locationId: data.selectedLocation }}/></section>}

      <section className="personal-metrics" aria-label="Performance summary">{cards.map(({ label, value, Icon }) => <article key={label}><span className="personal-icon"><Icon aria-hidden="true"/></span><div><small>{label}</small><strong>{value}</strong><span>Current activity</span></div></article>)}</section>

      <section className="personal-grid">
        <article className="personal-card personal-training"><header><h2>Training progress</h2><Link href="/training">View all <ArrowRight/></Link></header><div className="personal-training-body"><div className="personal-ring" style={{"--personal-progress": `${data.metrics.training * 3.6}deg`} as CSSProperties}><strong>{data.metrics.training}%</strong><small>Complete</small></div><div><strong>{data.metrics.training}% of assigned training completed</strong><ul><li><CheckCircle2/> Product knowledge</li><li><CheckCircle2/> Objection handling</li><li><CheckCircle2/> Follow-up strategies</li></ul></div></div><Link className="personal-primary" href="/training"><Play/> Continue training</Link></article>

        <article className="personal-card personal-snapshot"><header><h2>Performance snapshot</h2><span>Current view</span></header><div className="personal-bars">{progress.map((item) => <Link href={item.href} key={item.label}><span><item.Icon/>{item.label}</span><b>{item.value}</b><i><span style={{width: `${item.width}%`}}/></i></Link>)}</div><p>Activity shown for the selected dashboard scope.</p></article>

        <article className="personal-card personal-goals"><header><h2>Progress</h2><Link href="/training">Take action <ArrowRight/></Link></header>{progress.map((item) => <Link href={item.href} key={item.label}><span className="personal-icon"><item.Icon/></span><div><strong>{item.label}</strong><small>{item.value}</small><i><span style={{width: `${item.width}%`}}/></i></div></Link>)}</article>
      </section>

      <section className="personal-lower">
        <article className="personal-card personal-activity"><header><h2>Recent activity</h2>{data.team && <Link href="/dashboard/performance?view=company">View all <ArrowRight/></Link>}</header>{data.employees.length ? <ul>{data.employees.slice(0, 4).map((employee) => <li key={employee.id}><span><Clock3/></span><div><strong>{employee.name}</strong><small>{employee.questions} questions · {employee.messages} messages · {employee.training}% training</small></div><time>{employee.lastActivity}</time></li>)}</ul> : <p>No performance activity has been recorded yet.</p>}</article>

        <article className="personal-card personal-resources"><header><h2>Top resources for you</h2><Link href="/knowledge-base">See all <ArrowRight/></Link></header><div><Link href="/knowledge-base"><MessageSquare/><strong>Product Knowledge</strong><small>Approved answers</small></Link><Link href="/training"><GraduationCap/><strong>Training Library</strong><small>Learning modules</small></Link><Link href="/comparisons"><BarChart3/><strong>Comparisons</strong><small>Customer tools</small></Link></div></article>

        <aside className="personal-cta"><Target/><h2>You&apos;re on the right track.</h2><p>Keep learning, keep engaging, and keep creating value.</p><Link href="/training">Explore more training <ArrowRight/></Link></aside>
      </section>

      {data.team && <section className="personal-card personal-team"><header><div><h2>{data.scope === "company" ? "Location performance" : data.scope === "location" ? "Employee performance" : "Activity and training detail"}</h2><p>Compare the live records available in the selected scope.</p></div></header>{data.employees.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Role</th><th>Location</th><th>Questions</th><th>Messages</th><th>Training</th><th>Confidence</th><th>Last activity</th></tr></thead><tbody>{data.employees.map((employee) => <tr key={employee.id}><td><Link href={`/dashboard/performance?view=employee&employeeId=${employee.id}${employee.locationId ? `&locationId=${employee.locationId}` : ""}`}>{employee.name}</Link></td><td>{employee.role}</td><td>{employee.location}</td><td>{employee.questions}</td><td>{employee.messages}</td><td>{employee.training}%</td><td>{employee.confidence}</td><td>{employee.lastActivity}</td></tr>)}</tbody></table></div> : <p>No performance activity has been recorded yet.</p>}</section>}
    </main>
  </AppShell>;
}
