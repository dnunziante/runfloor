import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, Gauge, MapPin } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { getImprovementWorkspace } from "@/lib/operations/improvement-repository";
import { redirect } from "next/navigation";

export default async function ImprovementDashboardPage() {
  const data = await getImprovementWorkspace();
  if (!data.canManage) redirect("/operations/improvements");
  const processImprovements = data.items;
  const active = processImprovements.filter((item) => !["Verified", "Closed"].includes(item.status)).length;
  const assigned = processImprovements.filter((item) => item.owner !== "Unassigned").length;
  const measured = processImprovements.filter((item) => item.measurements.some((measure) => measure.phase === "After")).length;
  const representedLocations = new Set(processImprovements.map((item) => item.location).filter(Boolean)).size;
  const departments = ["Management", "Sales", "Service", "Administrative", "Delivery"].map((department) => ({ department, count: processImprovements.filter((item) => item.department === department).length }));
  return <AppShell title="Improvement Dashboard"><PageHeader eyebrow="Manager tools" title="See where improvement work is moving" description="A simple, explainable view of submissions, decisions, ownership, and measured results." action={<Link className="btn btn-ghost" href="/operations/improvements"><ArrowLeft size={16}/> Improvements</Link>}/><div className="callout operations-disclaimer"><Gauge size={20}/><div><strong>{data.persistence === "supabase" ? "Shared improvement performance" : "Temporary performance"}</strong><p>{data.persistence === "supabase" ? "Metrics use saved improvement records from this workspace. Verified savings and cross-location benchmarking are not included yet." : "Metrics use temporary sample records. Verified savings and cross-location benchmarking are intentionally not included yet."}</p></div></div>
    {data.error && <p className="form-error">{data.error}</p>}
    <section className="grid grid-4"><div className="card"><Clock3 size={18}/><div className="metric">{active}</div><p>Active improvements</p></div><div className="card"><CheckCircle2 size={18}/><div className="metric">{assigned}</div><p>Assigned to an owner</p></div><div className="card"><Gauge size={18}/><div className="metric">{measured}</div><p>With after measurements</p></div><div className="card"><MapPin size={18}/><div className="metric">{representedLocations}</div><p>Locations represented</p></div></section>
    {processImprovements.length ? <div className="grid grid-2 improvement-dashboard-grid"><section className="card"><h2>Submissions by department</h2>{departments.map((item) => <div className="improvement-bar" key={item.department}><div className="metric-row"><span>{item.department}</span><strong>{item.count}</strong></div><div className="progress"><span style={{width:`${item.count / processImprovements.length * 100}%`}}/></div></div>)}</section><section className="card"><h2>Workflow health</h2><div className="improvement-stage-list"><span><small>Submitted</small><strong>{processImprovements.filter((item) => item.status === "Submitted").length}</strong></span><span><small>Under review</small><strong>{processImprovements.filter((item) => item.status === "Under review").length}</strong></span><span><small>In progress</small><strong>{processImprovements.filter((item) => item.status === "In progress").length}</strong></span><span><small>Verified or closed</small><strong>{processImprovements.filter((item) => ["Verified", "Closed"].includes(item.status)).length}</strong></span></div></section></div> : <section className="card output empty"><div><Gauge size={28}/><h2>No improvement data yet</h2><p>The dashboard will populate after the first employee submission.</p></div></section>}
  </AppShell>;
}
