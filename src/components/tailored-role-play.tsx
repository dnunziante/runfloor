"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, Bookmark, Clock3, Lightbulb, MessageCircle, Play, Search, ShoppingCart, Sparkles, Target, Trophy } from "lucide-react";
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

export function TailoredRolePlay({ scenarios, sessionCount, averageScore, canManage, golfCart = false }: { scenarios: CoachScenario[]; sessionCount: number; averageScore: number | null; canManage: boolean; golfCart?: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState("All Scenarios");
  const [skill, setSkill] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [query, setQuery] = useState("");
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const skills = useMemo(() => [...new Set(scenarios.flatMap((item) => item.skills))].sort(), [scenarios]);
  const visible = useMemo(() => scenarios.filter((item) => (filter === "All Scenarios" || filter === "Advanced" && item.difficulty === "Advanced" || categoryFor(item) === filter) && (skill === "all" || item.skills.includes(skill)) && (difficulty === "all" || item.difficulty === difficulty) && `${item.title} ${item.category} ${item.opening} ${item.goal} ${item.skills.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [difficulty, filter, query, scenarios, skill]);

  if (golfCart) {
    const surprise = () => {
      const pool = visible.length ? visible : scenarios;
      if (!pool.length) return;
      const scenario = pool[Math.floor(Math.random() * pool.length)];
      router.push(`/coach/session?scenario=${encodeURIComponent(scenario.slug)}`);
    };
    return <div className={`${styles.content} ${styles.golfCartContent}`}>
      <section className={styles.golfFilters} aria-label="Role play filters">
        <label><span>Skill focus</span><span><Target/><select value={skill} onChange={(event) => setSkill(event.target.value)}><option value="all">All scenarios</option>{skills.map((item) => <option key={item}>{item}</option>)}</select></span></label>
        <label><span>Difficulty level</span><span><BarChart3/><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">All levels</option><option>Foundational</option><option>Intermediate</option><option>Advanced</option></select></span></label>
        <label><span>Product line</span><span><ShoppingCart/><select defaultValue="all" aria-label="Product line"><option value="all">All products</option></select></span></label>
        <label className={styles.golfSearch}><span className="sr-only">Search role play scenarios</span><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scenarios..."/></label>
        <button className={styles.surprise} type="button" onClick={surprise} disabled={!scenarios.length}><Sparkles/> Surprise me</button>
      </section>
      {visible.length ? <section className={styles.golfGrid} aria-label="Role play scenarios">{visible.slice(0, 6).map((scenario, index) => <article key={scenario.id} className={styles.golfCard}><div className={`${styles.golfCardImage} ${styles[`golfImage${index % 4}`]}`}><span className={styles[scenario.difficulty.toLowerCase()]}>{scenario.difficulty === "Foundational" ? "Beginner" : scenario.difficulty}</span><small><Clock3/> {scenario.duration}</small><button type="button" aria-label={`${bookmarks.includes(scenario.id) ? "Remove bookmark from" : "Bookmark"} ${scenario.title}`} aria-pressed={bookmarks.includes(scenario.id)} onClick={() => setBookmarks((current) => current.includes(scenario.id) ? current.filter((id) => id !== scenario.id) : [...current, scenario.id])}><Bookmark fill={bookmarks.includes(scenario.id) ? "currentColor" : "none"}/></button></div><div className={styles.golfCardBody}><h2>{scenario.title}</h2><p>{scenario.goal}</p><div className={styles.golfSkills}>{scenario.skills.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div><Link href={`/coach/session?scenario=${encodeURIComponent(scenario.slug)}`} className={styles.golfStart}><Play/> Start Scenario <ArrowRight/></Link></div></article>)}</section> : <div className={styles.empty}><Target size={43}/><h3>{scenarios.length ? "No scenarios match this view" : "No role play scenarios yet"}</h3><p>{scenarios.length ? "Try another skill, level, or search term." : "A workspace administrator can publish the first scenario for your team."}</p>{scenarios.length ? <button type="button" onClick={() => { setSkill("all"); setDifficulty("all"); setQuery(""); }}>Clear filters</button> : canManage ? <Link href="/admin/coach">Manage scenarios</Link> : null}</div>}
      <section className={styles.golfInsights} aria-label="Role play insights"><article><header><span><Trophy/></span><div><h2>Your Role Play Progress</h2><p>Keep practicing to build stronger skills.</p></div><Link href="/coach/review">View details <ArrowRight/></Link></header><div className={styles.golfProgress}><div className={styles.ring} style={{ "--score": `${averageScore ?? 0}%` } as React.CSSProperties}><strong>{averageScore === null ? "—" : `${averageScore}%`}</strong><small>Avg. score</small></div><dl><div><dt>Practice sessions</dt><dd>{sessionCount}</dd></div><div><dt>Scenarios available</dt><dd>{scenarios.length}</dd></div></dl></div></article><article><header><span><Play/></span><div><h2>Practice Library</h2><p>Choose another skill to strengthen.</p></div><Link href="/coach/scenarios">View all <ArrowRight/></Link></header><div className={styles.libraryStats}><strong>{scenarios.length}</strong><span>approved scenarios ready to practice</span><strong>{skills.length}</strong><span>skills represented in your library</span></div></article><article className={styles.coachingTip}><header><span><Lightbulb/></span><div><h2>Pro Coaching Tip</h2><p>Ask open-ended questions to uncover the reason behind an objection. This helps you address the true concern and keep the conversation positive.</p></div></header><b>People. Skills. Carts. Opportunities.</b></article></section>
    </div>;
  }

  return <div className={styles.content}><div className={styles.main}><div className={styles.heading}><h2>Choose a Role Play Scenario</h2><label><Search size={16}/><span className="sr-only">Search role play scenarios</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scenarios..."/></label></div><nav className={styles.filters} aria-label="Role play categories">{filters.map((item) => <button type="button" key={item} className={filter === item ? styles.selected : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</nav>
    {visible.length ? <div className={styles.grid}>{visible.map((scenario, index) => <article key={scenario.id} className={styles.card}><div className={`${styles.cardImage} ${styles[`image${index % 4}`]}`}><span className={styles[scenario.difficulty.toLowerCase()]}>{scenario.difficulty === "Foundational" ? "Beginner" : scenario.difficulty}</span></div><div className={styles.cardBody}><h3>{scenario.title}</h3><p>“{scenario.opening}”</p><div className={styles.meta}><span><MessageCircle size={14}/>{categoryFor(scenario)}</span><span><Clock3 size={14}/>{scenario.duration}</span></div><Link href={`/coach/session?scenario=${encodeURIComponent(scenario.slug)}`} className={styles.start}><Play size={15}/> Start Scenario <ArrowRight size={15}/></Link></div></article>)}</div> : <div className={styles.empty}><Target size={43}/><h3>{scenarios.length ? "No scenarios match this view" : "No role play scenarios yet"}</h3><p>{scenarios.length ? "Try another category or search term." : "A workspace administrator can publish the first scenario for your team."}</p>{scenarios.length ? <button type="button" onClick={() => { setFilter("All Scenarios"); setQuery(""); }}>Clear filters</button> : canManage ? <Link href="/admin/coach">Manage scenarios</Link> : null}</div>}</div>
    <aside className={styles.sidebar}><section className={styles.progress}><header><div><h2>Track Your Progress</h2><p>See your improvement.</p></div><Link href="/coach/review">View All</Link></header><div className={styles.progressBody}><div className={styles.ring} style={{ "--score": `${averageScore ?? 0}%` } as React.CSSProperties}><strong>{averageScore === null ? "—" : `${averageScore}%`}</strong><small>Avg. score</small></div><dl><div><dt>Recent sessions</dt><dd>{sessionCount}</dd></div><div><dt>Scenarios available</dt><dd>{scenarios.length}</dd></div></dl></div></section><section className={styles.tip}><Trophy size={31}/><h2>Confidence Creates Opportunity.</h2><p>The more you practice, the more natural it becomes on the sales floor.</p><blockquote>“Preparation turns hesitation into opportunity.”</blockquote></section><div className={styles.promo}>Better Conversations<br/>Lead to Bigger Adventures.</div></aside>
  </div>;
}
