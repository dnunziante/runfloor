"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3, CheckCircle2, ChevronRight, Clock3, Lightbulb, List, MapPin, MoreVertical, Search, Settings2, Trophy, UserRound } from "lucide-react";
import { useState } from "react";
import { ImprovementIntake } from "@/components/improvement-intake";
import type { ProcessImprovement } from "@/lib/operations/improvements";

type Scope = "All" | "Open" | "In review" | "Completed";

export function ImprovementHub({items,persistence,canManage}:{items:ProcessImprovement[];persistence:"demo"|"supabase";canManage:boolean}) {
  const [scope,setScope]=useState<Scope>("All");
  const [query,setQuery]=useState("");
  const [location,setLocation]=useState("All locations");
  const [kind,setKind]=useState("All types");
  const locations=[...new Set(items.map((item)=>item.location))];
  const completed=(status:ProcessImprovement["status"])=>status==="Verified"||status==="Closed";
  const inReview=(item:ProcessImprovement)=>item.managerDecision==="Pending"||item.status==="Under review";
  const counts={All:items.length,Open:items.filter((item)=>!completed(item.status)).length,"In review":items.filter(inReview).length,Completed:items.filter((item)=>completed(item.status)).length};
  const shown=items.filter((item)=>(scope==="All"||(scope==="Open"&&!completed(item.status))||(scope==="In review"&&inReview(item))||(scope==="Completed"&&completed(item.status)))&&(location==="All locations"||item.location===location)&&(kind==="All types"||item.kind===kind)&&(!query.trim()||`${item.title} ${item.description} ${item.department}`.toLowerCase().includes(query.trim().toLowerCase())));
  return <>
    <nav className="improvement-hub-filters" aria-label="Submission filters"><div>{(["All","Open","In review","Completed"] as Scope[]).map((value)=><button className={scope===value?"active":""} key={value} onClick={()=>setScope(value)}>{value==="All"?"All Submissions":value} ({counts[value]})</button>)}</div><label><Search/><span className="sr-only">Search submissions</span><input className="input" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search submissions..."/></label><select className="input" aria-label="Filter by location" value={location} onChange={(event)=>setLocation(event.target.value)}><option>All locations</option>{locations.map((value)=><option key={value}>{value}</option>)}</select><select className="input" aria-label="Filter by type" value={kind} onChange={(event)=>setKind(event.target.value)}><option>All types</option><option>Problem</option><option>Improvement</option></select>{canManage&&<Link className="btn btn-primary" href="/operations/improvements/review"><UserRound/> Manager review</Link>}</nav>
    <div className="improvement-hub-workspace"><ImprovementIntake tailored persistence={persistence}/><section className="improvement-hub-submissions"><header><span><List/></span><div><h2>Recent submissions</h2><p>Track the status of your ideas and see the impact they&apos;re making.</p></div><Link href="/operations/improvements/dashboard">View all <ChevronRight/></Link></header>{shown.length?<div className="improvement-table-wrap"><table><thead><tr><th>Title</th><th>Type</th><th>Location</th><th>Submitted</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{shown.slice(0,6).map((item)=><tr key={item.id}><td><span className={`submission-icon ${item.kind.toLowerCase()}`}>{item.kind==="Problem"?<AlertTriangle/>:<Lightbulb/>}</span><strong>{item.title}</strong><small>{item.description}</small></td><td><span className={`submission-type ${item.kind.toLowerCase()}`}>{item.kind==="Improvement"?<Lightbulb/>:<Settings2/>}{item.kind}</span></td><td><MapPin/>{item.location}</td><td>{new Date(item.submittedAt).toLocaleDateString()}<small>{new Date(item.submittedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</small></td><td><span className={`submission-status status-${item.status.toLowerCase().replaceAll(" ","-")}`}>{completed(item.status)?<CheckCircle2/>:<Clock3/>}{item.status}</span></td><td><Link aria-label={`View ${item.title}`} href={`/operations/improvements/${item.id}`}><MoreVertical/></Link></td></tr>)}</tbody></table><footer>Showing {Math.min(shown.length,6)} of {shown.length} matching submissions</footer></div>:<div className="output empty"><div><Lightbulb/><h2>No matching submissions</h2><p>Adjust the filters or share a new idea.</p></div></div>}<div className="improvement-hub-insights"><aside><BarChart3/><div><strong>See the impact</strong><p>Your ideas help us build a better experience for our team and customers.</p><Link href="/operations/improvements/dashboard">View improvement analytics <ChevronRight/></Link></div></aside><aside><Trophy/><div><strong>Pro Tip</strong><p>Be specific and include examples for faster review.</p><a href="#share-idea">Tips for great submissions <ChevronRight/></a></div></aside></div></section></div>
  </>;
}
