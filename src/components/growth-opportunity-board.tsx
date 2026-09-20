"use client";

import Link from "next/link";
import { ArrowRight, Clock3, ClipboardCheck, Handshake, Heart, Lightbulb, MapPin, Plus, Search, TrendingUp, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { calculateGrowthPriority, growthCategories, type GrowthCategory, type GrowthOpportunity, type GrowthScoreWeights } from "@/lib/growth/data";
import styles from "@/app/growth/growth-home.module.css";

const categories = [
  { name: "All opportunities", icon: Lightbulb }, { name: "Lead generation", icon: Users },
  { name: "Customer retention", icon: Heart }, { name: "Local market", icon: MapPin },
  { name: "Partnerships", icon: Handshake }, { name: "Expansion", icon: TrendingUp },
] as const;
const images: Record<GrowthCategory, string> = {
  "Lead generation": "/brand/rv-platform-v2.png", "Customer retention": "/brand/rv-roles-v2.png",
  "Local market": "/brand/rv-hero-v2.png", Partnerships: "/brand/rv-results-v2.png", Expansion: "/brand/rv-hero-v2.png",
};

export function GrowthOpportunityBoard({ opportunities, weights, canEdit = false }: { opportunities: GrowthOpportunity[]; weights: GrowthScoreWeights; canEdit?: boolean }) {
  const [category, setCategory] = useState("All opportunities");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("Priority score");
  const [status, setStatus] = useState("All statuses");
  const visible = useMemo(() => opportunities.filter((item) =>
    (category === "All opportunities" || item.category === category) &&
    (status === "All statuses" || (item.lifecycleStatus || "idea") === status) &&
    `${item.title} ${item.summary} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase()),
  ).sort((a, b) => sort === "Priority score" ? calculateGrowthPriority(b.score, weights) - calculateGrowthPriority(a.score, weights) : a.title.localeCompare(b.title)), [category, opportunities, query, sort, status, weights]);
  function clearFilters() { setQuery(""); setCategory("All opportunities"); setStatus("All statuses"); }
  return <>
    <div className={styles.toolbar}>
      <label className={styles.searchField}><Search size={19} aria-hidden="true" /><span className="sr-only">Search opportunities</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search opportunities..." /></label>
      <label className={styles.selectField}><span>Growth area</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{growthCategories.map((item) => <option key={item} value={item}>{item === "All opportunities" ? "All areas" : item}</option>)}</select></label>
      <label className={styles.selectField}><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option>Priority score</option><option>Opportunity name</option></select></label>
      <label className={styles.selectField}><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option value="idea">Idea</option><option value="under_review">Under review</option><option value="approved">Approved</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option></select></label>
      {canEdit && <Link className={styles.addButton} href="/admin/growth/opportunities"><Plus size={17} /> New opportunity</Link>}
    </div>
    <div className={styles.categoryRow} role="group" aria-label="Filter by growth area">
      {categories.map(({ name, icon: Icon }) => <button key={name} type="button" className={`${styles.categoryPill} ${category === name ? styles.selected : ""}`} onClick={() => setCategory(name)} aria-pressed={category === name}><Icon size={17} aria-hidden="true" />{name === "All opportunities" ? "All" : name}</button>)}
      <Link className={styles.plansLink} href="/growth/plans">View action plans <ArrowRight size={17} /></Link>
    </div>
    <p className={styles.resultCount} aria-live="polite">Showing {visible.length} of {opportunities.length} opportunities</p>
    {visible.length ? <div className={styles.board}>
      <div className={styles.cardGrid}>{visible.map((item) => {
        const score = calculateGrowthPriority(item.score, weights);
        return <article className={styles.opportunityCard} key={item.slug}>
          <div className={styles.cardImage} style={{ backgroundImage: `linear-gradient(0deg, rgba(4, 15, 20, .22), rgba(4, 15, 20, .04)), url("${images[item.category] || "/brand/rv-hero-v2.png"}")` }}><span className={styles.categoryBadge}>{item.category}</span><span className={styles.score}><strong>{score}</strong><small>Priority score</small></span></div>
          <div className={styles.cardContent}><h2>{item.title}</h2><p>{item.summary}</p><div className={styles.cardFooter}><div className={styles.facts}><span><Lightbulb size={17} /><b>{item.impact}</b><small>Impact</small></span><span><ClipboardCheck size={17} /><b>{item.effort}</b><small>Effort</small></span><span><Clock3 size={17} /><b>{item.timeframe}</b><small>Timeframe</small></span></div><Link href={`/growth/opportunities/${item.slug}`} className={styles.reviewButton}>Review opportunity <ArrowRight size={16} /></Link></div></div>
        </article>;
      })}</div>
      <aside className={styles.boardAside} aria-label="Growth planning">{canEdit && <div className={styles.ideaCard}><Lightbulb size={42} /><div><h2>Have a growth idea?</h2><p>Turn your idea into a structured opportunity, then evaluate its potential.</p><Link href="/admin/growth/opportunities"><Plus size={15} /> Add an opportunity</Link></div></div>}<div className={styles.quoteCard}>“A clearer path to growth.<br />A brighter future ahead.”<small>— RunFloor</small></div></aside>
    </div> : <div className={styles.empty}><Search size={28} /><h2>No matching opportunities</h2><p>Try another search, growth area, or status.</p><button type="button" onClick={clearFilters}><X size={15} /> Clear filters</button></div>}
  </>;
}
