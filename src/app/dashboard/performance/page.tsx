import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Bot, GraduationCap, Mail, TrendingUp } from "lucide-react";
import { getDashboardData } from "@/lib/dashboard/data";

function Selector({ label, name, value, options, hidden = {} }: { label: string; name: string; value?: string; options: { id: string; name: string }[]; hidden?: Record<string, string | undefined> }) {
  return <form action="/dashboard/performance" method="get" className="dashboard-selector">{Object.entries(hidden).map(([key, entry]) => entry ? <input key={key} type="hidden" name={key} value={entry}/> : null)}<label><span className="sr-only">{label}</span><select className="input" name={name} defaultValue={value}>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><button className="btn btn-secondary" type="submit">View</button></form>;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{view?:string;locationId?:string;employeeId?:string}> }) {
  const data = await getDashboardData(await searchParams);
  const cards = [["Questions answered", data.metrics.questions, Bot], ["Messages created", data.metrics.messages, Mail], ["Training completed", `${data.metrics.training}%`, GraduationCap], ["Team confidence", data.metrics.confidence, TrendingUp]] as const;
  const employees = [{ id: "team-overview", name: "Team — all store statistics" }, ...data.employees.map((employee) => ({ id: employee.id, name: employee.name }))];
  return <AppShell title={data.team ? "Team Dashboard" : "Personal Dashboard"}>
    <PageHeader eyebrow={data.team ? "Team performance" : "Personal performance"} title={data.title} description={data.subtitle}/>
    {data.team && <div className="card dashboard-view-controls">
      <Link className={`btn ${data.scope === "company" ? "btn-primary" : "btn-secondary"}`} href="/dashboard/performance?view=company">Company</Link>
      <Selector label="Location" name="locationId" value={data.selectedLocation} options={data.locations} hidden={{ view: "location" }}/>
      <Selector label="Employee" name="employeeId" value={data.selectedEmployee} options={employees} hidden={{ view: "employee", locationId: data.selectedLocation }}/>
    </div>}
    <div className="grid grid-4">{cards.map(([label, value, Icon]) => <div className="card" key={label}><div className="metric-row"><span>{label}</span><span className="metric-icon"><Icon size={18}/></span></div><div className="metric">{value}</div></div>)}</div>
    {data.team && data.scope !== "company" && <div className="card dashboard-scope-picker"><div className="metric-row"><h2>{data.scope === "location" ? "Location" : "Employee"} selection</h2><Selector label="Choose a location" name="locationId" value={data.selectedLocation} options={data.locations} hidden={{ view: "location" }}/></div></div>}
    <div className="card" style={{marginTop:18}}><h2>{data.scope === "company" ? "Location performance" : data.scope === "location" ? "Employee performance" : "Recent activity and training progress"}</h2>{data.employees.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Role</th><th>Location</th><th>Questions</th><th>Messages</th><th>Training</th><th>Confidence</th><th>Last activity</th></tr></thead><tbody>{data.employees.map((employee) => <tr key={employee.id}><td>{data.team ? <Link href={`/dashboard/performance?view=employee&employeeId=${employee.id}${employee.locationId ? `&locationId=${employee.locationId}` : ""}`}>{employee.name}</Link> : employee.name}</td><td>{employee.role}</td><td>{employee.location}</td><td>{employee.questions}</td><td>{employee.messages}</td><td>{employee.training}%</td><td>{employee.confidence}</td><td>{employee.lastActivity}</td></tr>)}</tbody></table></div> : <p>No performance activity has been recorded yet.</p>}</div>
  </AppShell>;
}
