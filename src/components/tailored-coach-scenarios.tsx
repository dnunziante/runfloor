"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, Clock3, Eye, MessageCircle, Search, Settings, Tag, Target, Trophy, Users, Wallet } from "lucide-react";
import type { CoachScenario } from "@/lib/coach/types";
import styles from "@/app/coach/scenarios/scenarios.module.css";

const categories = [
  { name: "All Scenarios", icon: Target, hint: "Every conversation" },
  { name: "Price & Payments", icon: Tag, hint: "Handle cost concerns" },
  { name: "Trade-In", icon: Wallet, hint: "Maximize value" },
  { name: "Just Looking", icon: Eye, hint: "Keep the door open" },
  { name: "Spouse / Partner", icon: Users, hint: "Get them both on board" },
  { name: "Inventory", icon: Boxes, hint: "Show the right fit" },
  { name: "Features & Benefits", icon: Settings, hint: "Highlight the value" },
  { name: "Competitors", icon: Trophy, hint: "Show your advantage" },
] as const;

function categoryFor(scenario: CoachScenario) {
  const subject = `${scenario.title} ${scenario.category} ${scenario.skills.join(" ")}`.toLowerCase();
  if (/spouse|partner|decision maker|wife|husband/.test(subject)) return "Spouse / Partner";
  if (/financ|payment|price|cost|expensive|budget|afford/.test(subject)) return "Price & Payments";
  if (/trade|exchange/.test(subject)) return "Trade-In";
  if (/look|browse|not ready|timing|follow-up/.test(subject)) return "Just Looking";
  if (/stock|inventor|availab|delivery/.test(subject)) return "Inventory";
  if (/competitor|comparison|other dealer/.test(subject)) return "Competitors";
  return "Features & Benefits";
}

export function TailoredCoachScenarios({ scenarios, canManage }: { scenarios: CoachScenario[]; canManage: boolean }) {
  const [category, setCategory] = useState("All Scenarios");
  const [skill, setSkill] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("relevant");
  const skills = useMemo(() => [...new Set(scenarios.flatMap((item) => item.skills))].sort(), [scenarios]);
  const visible = useMemo(() => {
    const filtered = scenarios.filter((item) => (category === "All Scenarios" || categoryFor(item) === category) && (skill === "all" || item.skills.includes(skill)) && (difficulty === "all" || item.difficulty === difficulty) && `${item.title} ${item.goal} ${item.customer} ${item.category} ${item.skills.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
    if (sort === "shortest") return [...filtered].sort((a, b) => a.durationMinutes - b.durationMinutes);
    if (sort === "az") return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    return filtered;
  }, [category, difficulty, query, scenarios, skill, sort]);

  return <div className={styles.content}>
    <section className={styles.filterTop} aria-label="Scenario filters"><label><span>Skill Focus</span><select value={skill} onChange={(event) => setSkill(event.target.value)}><option value="all">All skills</option>{skills.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Difficulty Level</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">All levels</option><option>Foundational</option><option>Intermediate</option><option>Advanced</option></select></label><label className={styles.search}><span className="sr-only">Search scenarios</span><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scenarios..."/></label><div className={styles.count}><strong>{scenarios.length}</strong><span>Scenarios Available</span></div></section>
    <section className={styles.browse}><h2>Browse by Category</h2><nav className={styles.categories} aria-label="Scenario categories">{categories.map(({ name, icon: Icon, hint }) => <button key={name} type="button" className={category === name ? styles.selected : ""} aria-pressed={category === name} onClick={() => setCategory(name)}><Icon size={25}/><strong>{name}</strong><small>{hint}</small></button>)}</nav></section>
    <div className={styles.lower}><section className={styles.list}><div className={styles.listHeading}><h2>Featured Practice Scenarios</h2><label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevant">Most Relevant</option><option value="shortest">Shortest First</option><option value="az">Title A–Z</option></select></label></div>{visible.length ? <div className={styles.grid}>{visible.map((scenario, index) => <article className={styles.card} key={scenario.id}><div className={`${styles.cardImage} ${styles[`image${index % 4}`]}`}><span className={styles[scenario.difficulty.toLowerCase()]}>{scenario.difficulty}</span></div><div className={styles.cardBody}><h3>{scenario.title}</h3><p>{scenario.opening || scenario.goal}</p><div className={styles.meta}><span><MessageCircle size={13}/>{categoryFor(scenario)}</span><span><Clock3 size={13}/>{scenario.duration}</span></div><Link href={`/coach/session?scenario=${encodeURIComponent(scenario.slug)}`} className={styles.start}>Start Practice <ArrowRight size={16}/></Link></div></article>)}</div> : <div className={styles.empty}><Target size={40}/><h3>{scenarios.length ? "No scenarios match these filters" : "No practice scenarios yet"}</h3><p>{scenarios.length ? "Try a different category, skill, level, or search term." : "Ask a workspace administrator to publish the first scenario."}</p>{scenarios.length > 0 ? <button type="button" onClick={() => { setCategory("All Scenarios"); setSkill("all"); setDifficulty("all"); setQuery(""); }}>Clear filters</button> : canManage ? <Link href="/admin/coach" className={styles.emptyAction}>Manage scenarios</Link> : null}</div>}</section><aside className={styles.aside}><div className={styles.promo}><strong>Confidence creates opportunity.</strong><span>Practice today.<br/>Close tomorrow.</span></div><div className={styles.tip}><Target size={22}/><strong>Pro Tip</strong><p>The more scenarios you practice, the more confident and natural you’ll be on the sales floor.</p></div></aside></div>
  </div>;
}
