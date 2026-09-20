"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, MessageCircle, Play, Search, Target, Trophy } from "lucide-react";
import type { CoachScenario } from "@/lib/coach/types";
import styles from "@/app/role-play/role-play.module.css";

const filters = ["All Scenarios", "Price & Payment", "Trade-In", "Just Looking", "Features & Benefits", "Spouse / Family", "Objections", "Advanced"];

function categoryFor(scenario: CoachScenario) {
  const subject = `${scenario.title} ${scenario.category} ${scenario.skills.join(" ")}`.toLowerCase();
  if (/spouse|partner|family|decision maker/.test(subject)) return "Spouse / Family";
  if (/trade|exchange/.test(subject)) return "Trade-In";
  if (/price|payment|financ|cost|budget|afford/.test(subject)) return "Price & Payment";
  if (/look|browse|not ready|timing/.test(subject)) return "Just Looking";
  if (/feature|product|benefit|model|fit/.test(subject)) return "Features & Benefits";
  return "Objections";
}

export function TailoredRolePlay({ scenarios, sessionCount, averageScore, canManage }: { scenarios: CoachScenario[]; sessionCount: number; averageScore: number | null; canManage: boolean }) {
  const [filter, setFilter] = useState("All Scenarios");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => scenarios.filter((item) => (filter === "All Scenarios" || filter === "Advanced" && item.difficulty === "Advanced" || categoryFor(item) === filter) && `${item.title} ${item.category} ${item.opening} ${item.skills.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [filter, query, scenarios]);

  return <div className={styles.content}><div className={styles.main}><div className={styles.heading}><h2>Choose a Role Play Scenario</h2><label><Search size={16}/><span className="sr-only">Search role play scenarios</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scenarios..."/></label></div><nav className={styles.filters} aria-label="Role play categories">{filters.map((item) => <button type="button" key={item} className={filter === item ? styles.selected : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</nav>
    {visible.length ? <div className={styles.grid}>{visible.map((scenario, index) => <article key={scenario.id} className={styles.card}><div className={`${styles.cardImage} ${styles[`image${index % 4}`]}`}><span className={styles[scenario.difficulty.toLowerCase()]}>{scenario.difficulty === "Foundational" ? "Beginner" : scenario.difficulty}</span></div><div className={styles.cardBody}><h3>{scenario.title}</h3><p>“{scenario.opening}”</p><div className={styles.meta}><span><MessageCircle size={14}/>{categoryFor(scenario)}</span><span><Clock3 size={14}/>{scenario.duration}</span></div><Link href={`/coach/session?scenario=${encodeURIComponent(scenario.slug)}`} className={styles.start}><Play size={15}/> Start Scenario <ArrowRight size={15}/></Link></div></article>)}</div> : <div className={styles.empty}><Target size={43}/><h3>{scenarios.length ? "No scenarios match this view" : "No role play scenarios yet"}</h3><p>{scenarios.length ? "Try another category or search term." : "A workspace administrator can publish the first scenario for your team."}</p>{scenarios.length ? <button type="button" onClick={() => { setFilter("All Scenarios"); setQuery(""); }}>Clear filters</button> : canManage ? <Link href="/admin/coach">Manage scenarios</Link> : null}</div>}</div>
    <aside className={styles.sidebar}><section className={styles.progress}><header><div><h2>Track Your Progress</h2><p>See your improvement.</p></div><Link href="/coach/review">View All</Link></header><div className={styles.progressBody}><div className={styles.ring} style={{ "--score": `${averageScore ?? 0}%` } as React.CSSProperties}><strong>{averageScore === null ? "—" : `${averageScore}%`}</strong><small>Avg. score</small></div><dl><div><dt>Recent sessions</dt><dd>{sessionCount}</dd></div><div><dt>Scenarios available</dt><dd>{scenarios.length}</dd></div></dl></div></section><section className={styles.tip}><Trophy size={31}/><h2>Confidence Creates Opportunity.</h2><p>The more you practice, the more natural it becomes on the sales floor.</p><blockquote>“Preparation turns hesitation into opportunity.”</blockquote></section><div className={styles.promo}>Better Conversations<br/>Lead to Bigger Adventures.</div></aside>
  </div>;
}
