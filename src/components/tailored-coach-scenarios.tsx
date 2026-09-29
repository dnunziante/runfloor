"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, Boxes, CalendarDays, Clock3, Eye, LayoutGrid, MessageCircle, Play, RefreshCw, Search, Settings, ShoppingCart, Tag, Target, Trophy, Users, Wallet, Wrench } from "lucide-react";
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

const golfCartCategories = [
  { name: "All Scenarios", icon: LayoutGrid },
  { name: "Price", icon: Tag },
  { name: "Objections", icon: MessageCircle },
  { name: "Trade-In", icon: RefreshCw },
  { name: "Product Knowledge", icon: BookOpen },
  { name: "Service & Parts", icon: Wrench },
  { name: "Follow-Up", icon: CalendarDays },
] as const;

function golfCartCategoryFor(scenario: CoachScenario) {
  const subject = `${scenario.title} ${scenario.category} ${scenario.goal} ${scenario.skills.join(" ")}`.toLowerCase();
  if (/trade|exchange/.test(subject)) return "Trade-In";
  if (/service|repair|maintenance|parts|warranty/.test(subject)) return "Service & Parts";
  if (/follow.?up|quiet lead|re.?engag|timing|not ready/.test(subject)) return "Follow-Up";
  if (/price|payment|financ|cost|expensive|budget|afford/.test(subject)) return "Price";
  if (/feature|product|model|recommend|inventory|cart|vehicle/.test(subject)) return "Product Knowledge";
  return "Objections";
}

export function TailoredCoachScenarios({ scenarios, canManage, golfCart = false }: { scenarios: CoachScenario[]; canManage: boolean; golfCart?: boolean }) {
  const [category, setCategory] = useState("All Scenarios");
  const [skill, setSkill] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("relevant");
  const skills = useMemo(() => [...new Set(scenarios.flatMap((item) => item.skills))].sort(), [scenarios]);
  const visible = useMemo(() => {
    const filtered = scenarios.filter((item) => (category === "All Scenarios" || (golfCart ? golfCartCategoryFor(item) : categoryFor(item)) === category) && (skill === "all" || item.skills.includes(skill)) && (difficulty === "all" || item.difficulty === difficulty) && `${item.title} ${item.goal} ${item.customer} ${item.category} ${item.skills.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
    if (sort === "shortest") return [...filtered].sort((a, b) => a.durationMinutes - b.durationMinutes);
    if (sort === "az") return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    return filtered;
  }, [category, difficulty, golfCart, query, scenarios, skill, sort]);

  if (golfCart) {
    const countFor = (name: string) => name === "All Scenarios" ? scenarios.length : scenarios.filter((item) => golfCartCategoryFor(item) === name).length;
    return <div className={`${styles.content} ${styles.golfCartContent}`}>
      <section className={styles.golfFilters} aria-label="Scenario filters">
        <label><span>Skill focus</span><span className={styles.golfSelect}><BarChart3/><select value={skill} onChange={(event) => setSkill(event.target.value)}><option value="all">All scenarios</option>{skills.map((item) => <option key={item}>{item}</option>)}</select></span></label>
        <label><span>Difficulty level</span><span className={styles.golfSelect}><BarChart3/><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">All levels</option><option>Foundational</option><option>Intermediate</option><option>Advanced</option></select></span></label>
        <label><span>Product line</span><span className={styles.golfSelect}><ShoppingCart/><select defaultValue="all" aria-label="Product line"><option value="all">All products</option></select></span></label>
        <div className={styles.golfCount}><strong>{visible.length} scenarios</strong><span>Ready to help you grow</span></div>
        <label className={styles.golfSearch}><span className="sr-only">Search scenarios</span><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scenarios, skills, or keywords..."/></label>
      </section>
      <nav className={styles.golfCategories} aria-label="Scenario categories">{golfCartCategories.map(({ name, icon: Icon }) => <button key={name} type="button" className={category === name ? styles.golfCategoryActive : ""} aria-pressed={category === name} onClick={() => setCategory(name)}><Icon/><span>{name} ({countFor(name)})</span></button>)}</nav>
      {visible.length ? <section className={styles.golfGrid} aria-label="Practice scenarios">{visible.slice(0, 12).map((scenario, index) => <article className={styles.golfCard} key={scenario.id}><div className={`${styles.golfCardImage} ${styles[`golfImage${index % 4}`]}`}><span className={styles[scenario.difficulty.toLowerCase()]}>{scenario.difficulty}</span><small><Clock3/> {scenario.duration}</small></div><div className={styles.golfCardBody}><h2>{scenario.title}</h2><p>{scenario.goal}</p><div className={styles.golfSkills}>{scenario.skills.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div><Link href={`/coach/session?scenario=${encodeURIComponent(scenario.slug)}`} className={styles.golfStart}><Play/> Start Scenario <ArrowRight/></Link></div></article>)}</section> : <div className={styles.empty}><Target size={40}/><h3>{scenarios.length ? "No scenarios match these filters" : "No practice scenarios yet"}</h3><p>{scenarios.length ? "Try a different category, skill, level, or search term." : "Ask a workspace administrator to publish the first scenario."}</p>{scenarios.length > 0 ? <button type="button" onClick={() => { setCategory("All Scenarios"); setSkill("all"); setDifficulty("all"); setQuery(""); }}>Clear filters</button> : canManage ? <Link href="/admin/coach" className={styles.emptyAction}>Manage scenarios</Link> : null}</div>}
    </div>;
  }

  return <div className={styles.content}>
    <section className={styles.filterTop} aria-label="Scenario filters"><label><span>Skill Focus</span><select value={skill} onChange={(event) => setSkill(event.target.value)}><option value="all">All skills</option>{skills.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Difficulty Level</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">All levels</option><option>Foundational</option><option>Intermediate</option><option>Advanced</option></select></label><label className={styles.search}><span className="sr-only">Search scenarios</span><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scenarios..."/></label><div className={styles.count}><strong>{scenarios.length}</strong><span>Scenarios Available</span></div></section>
    <section className={styles.browse}><h2>Browse by Category</h2><nav className={styles.categories} aria-label="Scenario categories">{categories.map(({ name, icon: Icon, hint }) => <button key={name} type="button" className={category === name ? styles.selected : ""} aria-pressed={category === name} onClick={() => setCategory(name)}><Icon size={25}/><strong>{name}</strong><small>{hint}</small></button>)}</nav></section>
    <div className={styles.lower}><section className={styles.list}><div className={styles.listHeading}><h2>Featured Practice Scenarios</h2><label>Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevant">Most Relevant</option><option value="shortest">Shortest First</option><option value="az">Title A–Z</option></select></label></div>{visible.length ? <div className={styles.grid}>{visible.map((scenario, index) => <article className={styles.card} key={scenario.id}><div className={`${styles.cardImage} ${styles[`image${index % 4}`]}`}><span className={styles[scenario.difficulty.toLowerCase()]}>{scenario.difficulty}</span></div><div className={styles.cardBody}><h3>{scenario.title}</h3><p>{scenario.opening || scenario.goal}</p><div className={styles.meta}><span><MessageCircle size={13}/>{categoryFor(scenario)}</span><span><Clock3 size={13}/>{scenario.duration}</span></div><Link href={`/coach/session?scenario=${encodeURIComponent(scenario.slug)}`} className={styles.start}>Start Practice <ArrowRight size={16}/></Link></div></article>)}</div> : <div className={styles.empty}><Target size={40}/><h3>{scenarios.length ? "No scenarios match these filters" : "No practice scenarios yet"}</h3><p>{scenarios.length ? "Try a different category, skill, level, or search term." : "Ask a workspace administrator to publish the first scenario."}</p>{scenarios.length > 0 ? <button type="button" onClick={() => { setCategory("All Scenarios"); setSkill("all"); setDifficulty("all"); setQuery(""); }}>Clear filters</button> : canManage ? <Link href="/admin/coach" className={styles.emptyAction}>Manage scenarios</Link> : null}</div>}</section><aside className={styles.aside}><div className={styles.promo}><strong>Confidence creates opportunity.</strong><span>Practice today.<br/>Close tomorrow.</span></div><div className={styles.tip}><Target size={22}/><strong>Pro Tip</strong><p>The more scenarios you practice, the more confident and natural you’ll be on the sales floor.</p></div></aside></div>
  </div>;
}
