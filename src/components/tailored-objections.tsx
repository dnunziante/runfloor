"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Boxes, CreditCard, Eye, MessageCircle, Package, Search, Settings2, Sparkles, Star, Tag, Trophy, Users, Wallet, X } from "lucide-react";
import type { ObjectionResponse } from "@/components/objection-handling";
import styles from "@/app/objections/objections.module.css";

const categories = [
  { name: "All Objections", icon: MessageCircle, hint: "Every response" },
  { name: "Price", icon: Tag, hint: "Value and cost" },
  { name: "Payments & Financing", icon: CreditCard, hint: "Payment options" },
  { name: "Trade-In", icon: Wallet, hint: "Exchange value" },
  { name: "Just Looking", icon: Eye, hint: "Keep the door open" },
  { name: "Spouse / Partner", icon: Users, hint: "Include decision makers" },
  { name: "Inventory", icon: Boxes, hint: "Availability and timing" },
  { name: "Features", icon: Package, hint: "Educate and compare" },
  { name: "Competitors", icon: Trophy, hint: "Show the difference" },
] as const;

function categoryFor(item: ObjectionResponse) {
  const subject = `${item.title} ${item.type}`.toLowerCase();
  if (/spouse|partner|decision maker|wife|husband/.test(subject)) return "Spouse / Partner";
  if (/financ|payment|monthly|credit/.test(subject)) return "Payments & Financing";
  if (/trade|exchange/.test(subject)) return "Trade-In";
  if (/price|cost|expensive|afford|budget/.test(subject)) return "Price";
  if (/look|browse|think|timing|not ready/.test(subject)) return "Just Looking";
  if (/stock|inventor|availab|delivery/.test(subject)) return "Inventory";
  if (/competitor|other dealer|elsewhere|match/.test(subject)) return "Competitors";
  return "Features";
}

export function TailoredObjections({ objections, canManage }: { objections: ObjectionResponse[]; canManage: boolean }) {
  const [category, setCategory] = useState("All Objections");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const visible = useMemo(() => {
    const matches = objections.filter((item) => (category === "All Objections" || categoryFor(item) === category) && `${item.title} ${item.type} ${item.response}`.toLowerCase().includes(query.toLowerCase()));
    return sort === "az" ? [...matches].sort((a, b) => a.title.localeCompare(b.title)) : matches;
  }, [category, objections, query, sort]);

  return <div className={styles.content}>
    <nav className={styles.categories} aria-label="Objection categories">{categories.map(({ name, icon: Icon, hint }) => <button key={name} type="button" className={category === name ? styles.activeCategory : ""} onClick={() => { setCategory(name); setSelectedId(null); }} aria-pressed={category === name}><Icon size={25}/><strong>{name}</strong><small>{hint}</small></button>)}</nav>
    <div className={styles.workspace}>
      <aside className={styles.quickActions}><h2>Quick Actions</h2><Link className={styles.darkAction} href="/coach/session?mode=objection"><Sparkles size={22}/><span><strong>Practice a response</strong><small>Rehearse a live objection</small></span></Link>{canManage && <Link className={styles.action} href="/admin/content/objection_response"><BookOpen size={18}/> Manage responses <ArrowRight size={15}/></Link>}<Link className={styles.action} href="/coach"><Settings2 size={18}/> Sales Coach <ArrowRight size={15}/></Link><div className={styles.tip}><Sparkles size={22}/><strong>Pro Tip</strong><p>Listen, acknowledge, add value, then ask a question to move the conversation forward.</p></div></aside>
      <section className={styles.library} aria-label="Approved objection responses"><div className={styles.filters}><label className={styles.search}><Search size={17}/><span className="sr-only">Search objection responses</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search objection responses..."/>{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={15}/></button>}</label><label className={styles.select}><span className="sr-only">Filter category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label className={styles.select}><span className="sr-only">Sort responses</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Most Recent</option><option value="az">Title A–Z</option></select></label><span className={styles.count}>{visible.length} {visible.length === 1 ? "response" : "responses"}</span></div>
      {visible.length ? <div className={styles.rows}>{visible.map((item) => <article key={item.id} className={styles.row}><div className={styles.rowSummary}><div><h3>{item.title}</h3><span className={styles.badge}>{categoryFor(item)}</span></div><p>{item.response}</p><button className={styles.viewButton} type="button" aria-expanded={selectedId === item.id} onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}>{selectedId === item.id ? "Hide Response" : "View Response"}<ArrowRight size={16}/></button><button className={styles.star} type="button" aria-label={`${favorites.includes(item.id) ? "Remove" : "Add"} favorite: ${item.title}`} aria-pressed={favorites.includes(item.id)} onClick={() => setFavorites(favorites.includes(item.id) ? favorites.filter((id) => id !== item.id) : [...favorites, item.id])}><Star size={17} fill={favorites.includes(item.id) ? "currentColor" : "none"}/></button></div>{selectedId === item.id && <div className={styles.expanded}><strong>Approved response</strong><p>“{item.response}”</p><strong>Follow-up question</strong><p>{item.followUp}</p><Link className="btn btn-primary" href="/coach/session?mode=objection">Practice this objection <ArrowRight size={15}/></Link></div>}</article>)}</div> : <div className={styles.empty}><MessageCircle size={39}/><h2>{objections.length ? "No responses match your filters" : "No published objection responses yet"}</h2><p>{objections.length ? "Try a different category or search term." : "A workspace administrator can publish approved responses in Sales Content."}</p>{objections.length ? <button className="btn btn-secondary" onClick={() => { setCategory("All Objections"); setQuery(""); }}>Clear filters</button> : canManage ? <Link className="btn btn-primary" href="/admin/content/objection_response">Manage responses</Link> : null}</div>}
      </section>
    </div>
  </div>;
}
