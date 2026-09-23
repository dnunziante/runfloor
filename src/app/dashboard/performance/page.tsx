import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, BarChart3, BookOpenCheck, Bot, Calculator, CheckCircle2, ClipboardCheck, Clock3, GraduationCap, Mail, MessageSquare, Play, Star, Target, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getViewer } from "@/lib/auth/viewer";
import { getDashboardData } from "@/lib/dashboard/data";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";

function Selector({ label, name, value, options, hidden = {} }: { label: string; name: string; value?: string; options: { id: string; name: string }[]; hidden?: Record<string, string | undefined> }) {
  return <form action="/dashboard/performance" method="get" className="dashboard-selector">{Object.entries(hidden).map(([key, entry]) => entry ? <input key={key} type="hidden" name={key} value={entry}/> : null)}<label><span className="dashboard-selector-label">{label}</span><select className="input" name={name} defaultValue={value}>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><button className="btn btn-secondary" type="submit">View</button></form>;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{view?:string;locationId?:string;employeeId?:string}> }) {
  const filters = await searchParams;
  const [data, viewer] = await Promise.all([getDashboardData(filters), getViewer()]);
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const isRv = templateKey === "rv";
  const isGolfCart = templateKey === "golf-cart";
  const employees = [{ id: "team-overview", name: "Team — all store statistics" }, ...data.employees.map((employee) => ({ id: employee.id, name: employee.name }))];
  const person = data.scope === "employee" ? data.employees[0]?.name.split(" ")[0] : undefined;
  const cards = [
    { label: "Questions answered", value: data.metrics.questions, Icon: Bot },
    { label: "Messages created", value: data.metrics.messages, Icon: Mail },
    { label: "Training completed", value: `${data.metrics.training}%`, Icon: GraduationCap },
    { label: "Team confidence", value: `${data.metrics.confidence} / 5`, Icon: Star },
    ...(isGolfCart ? [{ label: "People in view", value: data.employees.length, Icon: Users }] : []),
  ];
  const progress = [
    { label: "Questions answered", value: data.metrics.questions, width: Math.min(data.metrics.questions, 100), Icon: MessageSquare, href: "/assistant" },
    { label: "Messages created", value: data.metrics.messages, width: Math.min(data.metrics.messages * 2, 100), Icon: Mail, href: "/email" },
    { label: "Training complete", value: `${data.metrics.training}%`, width: data.metrics.training, Icon: GraduationCap, href: "/training" },
  ];

  const resources = isRv
    ? [[MessageSquare, "Product Knowledge", "Approved answers", "/knowledge-base"], [GraduationCap, "Training Library", "Learning modules", "/training"], [BarChart3, "Competitors", "Compare models", "/comparisons"], [Calculator, "Finance & F&I", "Sell more confidently", "/pricing-calculator"]] as const
    : isGolfCart
    ? [[MessageSquare, "Product Library", "Specs, compare, position", "/products"], [BookOpenCheck, "Procedure Library", "Service and delivery setup", "/operations/procedures"], [Mail, "Email Generator", "Customer-ready messages", "/email"], [Calculator, "Golf Cart Comparisons", "Side-by-side models", "/comparisons"], [GraduationCap, "Training Library", "Team development", "/training"], [ClipboardCheck, "Checklists", "Proven workflows", "/operations/checklists"]] as const
    : [[MessageSquare, "Product Knowledge", "Approved answers", "/knowledge-base"], [GraduationCap, "Training Library", "Learning modules", "/training"], [BarChart3, "Comparisons", "Customer tools", "/comparisons"]] as const;

  const quickActions = [[ClipboardCheck, "New checklist", "/operations/checklists"], [Mail, "Write an email", "/email"], [BookOpenCheck, "Find a procedure", "/operations/procedures"], [BarChart3, "View performance", "/analytics"]] as const;

  return <AppShell title={data.team ? "Team Dashboard" : "Personal Dashboard"} industry={isRv ? "rv" : isGolfCart ? "golf-cart" : undefined}>
    <main className={`personal-command ${isRv ? "rv-performance" : ""} ${isGolfCart ? "golf-cart-performance" : ""}`}>
      <section className="personal-hero" aria-labelledby="performance-title">
        <div><span>{isGolfCart ? viewer?.organizationName : data.team ? "Team performance" : "Personal performance"}</span><h1 id="performance-title">{isGolfCart ? <>{data.team ? "Team Performance" : "My Performance"}<br/><em>Drive Community Growth.</em></> : person ? <>Good morning, {person}! <i aria-hidden="true">👋</i></> : isRv && data.scope === "company" ? <>{viewer?.organizationName} — <em>Company Overview</em></> : data.title}</h1><p>{isGolfCart ? <>Track progress, training, engagement, and results in one place—built for golf cart and LSV dealerships.</> : isRv && data.scope === "company" ? <>Performance across all {viewer?.organizationName} locations. People. Processes. Profit.</> : data.subtitle}</p></div>
        <blockquote>{isRv ? <>“More Families.<br/>Greater Adventures.”</> : isGolfCart ? <>Street Legal.<br/>Community Ready.<br/>Bigger Opportunities.</> : <>“Small steps<br/>create big results.”<small>— RunFloor</small></>}</blockquote>
        {!isRv && !isGolfCart && <strong>Learn.<br/>Apply.<br/>Close.<br/><em>Grow.</em></strong>}
      </section>

      {data.team && <section className="personal-controls" aria-label="Dashboard view controls"><Link className={data.scope === "company" ? "active" : ""} href="/dashboard/performance?view=company">Company</Link><Selector label="Location" name="locationId" value={data.selectedLocation} options={data.locations} hidden={{ view: "location" }}/><Selector label="Employee" name="employeeId" value={data.selectedEmployee} options={employees} hidden={{ view: "employee", locationId: data.selectedLocation }}/></section>}

      <section className="personal-metrics" aria-label="Performance summary">{cards.map(({ label, value, Icon }) => <article key={label}><span className="personal-icon"><Icon aria-hidden="true"/></span><div><small>{label}</small><strong>{value}</strong><span>Current activity</span></div></article>)}</section>

      <section className="personal-grid">
        <article className="personal-card personal-training"><header><h2>Training progress</h2><Link href="/training">View all <ArrowRight/></Link></header><div className="personal-training-body"><div className="personal-ring" style={{"--personal-progress": `${data.metrics.training * 3.6}deg`} as CSSProperties}><strong>{data.metrics.training}%</strong><small>Complete</small></div><div><strong>{data.metrics.training}% of assigned training completed</strong><ul><li><CheckCircle2/> Product knowledge</li><li><CheckCircle2/> Objection handling</li><li><CheckCircle2/> Follow-up strategies</li>{isRv && <li><CheckCircle2/> RV finance &amp; F&amp;I basics</li>}</ul></div></div><Link className="personal-primary" href="/training"><Play/> Continue training <ArrowRight/></Link></article>

        <article className="personal-card personal-snapshot"><header><h2>Performance snapshot</h2><span>Current view</span></header><div className="personal-bars">{progress.map((item) => <Link href={item.href} key={item.label}><span><item.Icon/>{item.label}</span><b>{item.value}</b><i><span style={{width: `${item.width}%`}}/></i></Link>)}</div><p>Activity shown for the selected dashboard scope.</p></article>

        <article className="personal-card personal-goals"><header><h2>{isGolfCart ? "Quick actions" : "Progress"}</h2><Link href={isGolfCart ? "/dashboard" : "/training"}>{isGolfCart ? "Home" : "Take action"} <ArrowRight/></Link></header>{isGolfCart ? <div className="golf-cart-quick-actions">{quickActions.map(([Icon,label,href]) => <Link href={href} key={label}><span className="personal-icon"><Icon/></span><strong>{label}</strong><ArrowRight/></Link>)}</div> : progress.map((item) => <Link href={item.href} key={item.label}><span className="personal-icon"><item.Icon/></span><div><strong>{item.label}</strong><small>{item.value}</small><i><span style={{width: `${item.width}%`}}/></i></div></Link>)}</article>
      </section>

      <section className="personal-lower">
        <article className="personal-card personal-activity"><header><h2>Recent activity</h2>{data.team && <Link href="/dashboard/performance?view=company">View all <ArrowRight/></Link>}</header>{data.employees.length ? <ul>{data.employees.slice(0, 4).map((employee) => <li key={employee.id}><span><Clock3/></span><div><strong>{employee.name}</strong><small>{employee.questions} questions · {employee.messages} messages · {employee.training}% training</small></div><time>{employee.lastActivity}</time></li>)}</ul> : <p>No performance activity has been recorded yet.</p>}</article>

        <article className="personal-card personal-resources"><header><h2>{isGolfCart ? "Top resources for your team" : "Top resources for you"}</h2><Link href="/knowledge-base">See all <ArrowRight/></Link></header><div>{resources.map(([Icon, label, copy, href]) => <Link href={href} key={label}><Icon/><strong>{label}</strong><small>{copy}</small><ArrowRight className="resource-arrow"/></Link>)}</div></article>

        <aside className="personal-cta"><Target/><h2>{isGolfCart ? <>More Communities.<br/><em>More Freedom.</em><br/>More Revenue.</> : <>You&apos;re on <em>the right track.</em></>}</h2><p>{isGolfCart ? "Help more people get where they want to go. Build lifelong customers and serve your community." : isRv ? "Keep learning, keep growing, and help more families find their perfect RV." : "Keep learning, keep engaging, and keep creating value."}</p><Link href="/training">Explore training &amp; tools <ArrowRight/></Link></aside>
      </section>

      {data.team && <section className="personal-card personal-team"><header><div><h2>{data.scope === "company" ? "Location performance" : data.scope === "location" ? "Employee performance" : "Activity and training detail"}</h2><p>Compare the live records available in the selected scope.</p></div></header>{data.employees.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Role</th><th>Location</th><th>Questions</th><th>Messages</th><th>Training</th><th>Confidence</th><th>Last activity</th></tr></thead><tbody>{data.employees.map((employee) => <tr key={employee.id}><td><Link href={`/dashboard/performance?view=employee&employeeId=${employee.id}${employee.locationId ? `&locationId=${employee.locationId}` : ""}`}>{employee.name}</Link></td><td>{employee.role}</td><td>{employee.location}</td><td>{employee.questions}</td><td>{employee.messages}</td><td>{employee.training}%</td><td>{employee.confidence}</td><td>{employee.lastActivity}</td></tr>)}</tbody></table></div> : <p>No performance activity has been recorded yet.</p>}</section>}
    </main>
  </AppShell>;
}
