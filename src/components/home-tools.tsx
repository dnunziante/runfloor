"use client";
import { ENABLE_SALES_COACHING } from "@/lib/features";
import { soloAllowsPath } from "@/lib/plans/policy";
import { useState } from "react";
import { FeatureLink as Link } from "@/components/feature-link";
import { BarChart3, BookOpen, Bot, Boxes, Search, Settings2, Tags, Users, Zap } from "lucide-react";

export function HomeTools({ admin, team, planKey }: { admin: boolean; team: boolean; planKey?: string }) {
  const [query, setQuery] = useState("");
  const [customize, setCustomize] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const actions = [[Bot,"Ask the Assistant","Get instant answers","/assistant","orange"],[Boxes,admin ? "Add a Product" : "View Products","Explore your catalog",admin ? "/admin/products" : "/products","blue"],[Users,planKey === "sales_solo" ? "My Performance" : admin ? "Manage Team" : "Team Performance",planKey === "sales_solo" ? "My Sales activity" : ENABLE_SALES_COACHING ? "People and training" : "People and roles",admin ? "/admin/users" : "/dashboard/performance","green"],[BookOpen,"View Procedures","Step-by-step guides","/operations/procedures","purple"],[Tags,"Track Competitors","Explore other models","/competitors","pink"],[BarChart3,"View Reports","Performance insights",team ? "/executive" : "/dashboard/performance","blue"]] as const;
  const visibleActions = actions.filter(([, , , href]) => planKey !== "sales_solo" || soloAllowsPath(href));
  return <section className="home-card home-quick"><div className="home-section-title"><h2><Zap size={20}/> Quick actions</h2><button onClick={()=>setCustomize(!customize)} aria-expanded={customize}><Settings2 size={13}/>{customize ? "Done" : "Customize"}</button></div>
    {customize && <div className="home-customize"><p>Choose which shortcuts to show on this visit.</p>{visibleActions.map(([,label])=><label key={label}><input type="checkbox" checked={!hidden.includes(label)} onChange={(event)=>setHidden(event.target.checked ? hidden.filter((value)=>value!==label) : [...hidden,label])}/>{label}</label>)}</div>}
    <label className="home-search"><Search size={15}/><input aria-label="Find a quick action" placeholder="Find a tool..." value={query} onChange={(event)=>setQuery(event.target.value)}/></label>
    <div className="home-quick-grid">{visibleActions.filter(([,label])=>!hidden.includes(label)&&label.toLowerCase().includes(query.toLowerCase())).map(([Icon,label,copy,href,color])=><Link key={label} href={href} className={color}><span className={`home-icon ${color}`}><Icon size={22}/></span><strong>{label}</strong><small>{copy}</small></Link>)}</div>
    {visibleActions.every(([,label])=>hidden.includes(label)||!label.toLowerCase().includes(query.toLowerCase())) && <p>No matching shortcuts. Change your search or customize the list.</p>}
  </section>;
}
