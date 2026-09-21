"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, DollarSign, Lightbulb, LoaderCircle, Save, Search, Settings, Shield, ShieldAlert, SlidersHorizontal, Target, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { saveGrowthScoring } from "@/app/admin/growth/actions";
import { calculateGrowthPriority, growthCategories, growthPriorityLabel, growthScoreWeights, type GrowthOpportunity, type GrowthScore, type GrowthScoreWeights } from "@/lib/growth/data";
import styles from "@/app/admin/growth/scoring.module.css";

const dimensions = [
  { key: "impact", label: "Impact", hint: "Higher is better", icon: BarChart3 },
  { key: "effort", label: "Effort", hint: "Lower is better", icon: Settings },
  { key: "confidence", label: "Confidence", hint: "Higher is better", icon: Shield },
  { key: "cost", label: "Cost", hint: "Lower is better", icon: DollarSign },
  { key: "risk", label: "Risk", hint: "Lower is better", icon: ShieldAlert },
  { key: "alignment", label: "Strategic alignment", hint: "Higher is better", icon: Target },
] as const;

export function AdminGrowthScoringEditor({ opportunities, initialWeights, persistence, canEdit }: { opportunities: GrowthOpportunity[]; initialWeights: GrowthScoreWeights; persistence: "demo" | "supabase"; canEdit: boolean }) {
  const [weights, setWeights] = useState(initialWeights);
  const [scores, setScores] = useState<Record<string, GrowthScore>>(Object.fromEntries(opportunities.map((item) => [item.slug, item.score])));
  const [category, setCategory] = useState("All opportunities");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (persistence !== "demo") return; const timer = window.setTimeout(() => { try { const saved = JSON.parse(window.localStorage.getItem("commandly-demo-growth-scoring") || "null") as { weights?: GrowthScoreWeights; scores?: Record<string, GrowthScore> } | null; if (saved?.weights && saved?.scores) { setWeights(saved.weights); setScores(saved.scores); } } catch { /* Keep sample data when browser storage is invalid. */ } }, 0); return () => window.clearTimeout(timer); }, [persistence]);
  const total = useMemo(() => Object.values(weights).reduce((sum, value) => sum + value, 0), [weights]);
  const validWeights = Object.values(weights).every((value) => Number.isInteger(value) && value >= 0 && value <= 100) && total === 100;
  const validScores = Object.values(scores).every((score) => Object.values(score).every((value) => Number.isInteger(value) && value >= 1 && value <= 5));
  const visible = useMemo(() => opportunities.filter((item) => (category === "All opportunities" || item.category === category) && (item.title.toLowerCase().includes(search.toLowerCase().trim()) || item.category.toLowerCase().includes(search.toLowerCase().trim()))).sort((a, b) => calculateGrowthPriority(scores[b.slug] ?? b.score, weights) - calculateGrowthPriority(scores[a.slug] ?? a.score, weights)), [opportunities, category, search, scores, weights]);

  function setWeight(key: keyof GrowthScore, value: number) { setWeights((current) => ({ ...current, [key]: value })); setMessage(""); }
  function setRating(slug: string, key: keyof GrowthScore, value: number) { setScores((current) => ({ ...current, [slug]: { ...current[slug], [key]: value } })); setMessage(""); }
  async function submit() {
    if (!validWeights) { setMessage("Weights must be whole numbers totaling exactly 100."); return; }
    if (!validScores) { setMessage("Every rating must be a whole number from 1 to 5."); return; }
    setSaving(true);
    try {
      if (persistence === "demo") { window.localStorage.setItem("commandly-demo-growth-scoring", JSON.stringify({ weights, scores })); setMessage("Demo scoring saved in this browser."); }
      else { const result = await saveGrowthScoring(weights, scores); setMessage(result.error || "Scoring configuration saved for this organization."); }
    } catch { setMessage("Scoring could not be saved. Please try again."); }
    finally { setSaving(false); }
  }
  if (!canEdit) return <div className={styles.body}><section className={styles.access}><h2>Administrator access required</h2><p>Only tenant administrators can change scoring weights and ratings.</p><Link href="/growth/priorities">View priority scoring <ArrowRight size={16}/></Link></section></div>;
  return <div className={styles.body}>
    <div className={styles.topActions}>
      <Link href="/admin/growth/opportunities"><Settings size={17} aria-hidden="true" />Manage opportunities</Link>
      <button type="button" className={styles.saveButton} onClick={submit} disabled={saving || !validWeights || !validScores}>{saving ? <><LoaderCircle className="spin" size={17} />Saving</> : <><Save size={17} />Save changes</>}</button>
    </div>
    <section className={styles.section} aria-labelledby="weights-heading">
      <div className={styles.sectionHeader}><Target aria-hidden="true" /><div><h2 id="weights-heading">Organization weights</h2><p>Configure how each factor contributes to the 100-point score.</p></div><div className={`${styles.total} ${validWeights ? styles.valid : styles.invalid}`} aria-live="polite">Total <strong>{total}</strong> /100 {validWeights && <CheckCircle2 size={20} aria-label="Valid total" />}</div></div>
      <div className={styles.weightGrid}>{dimensions.map(({ key, label, hint, icon: Icon }) => <label className={`${styles.weightCard} ${styles[key]}`} key={key}><span className={styles.weightTop}><Icon aria-hidden="true" /><span><b>{label}</b><strong>{weights[key]} pts</strong></span></span><input aria-label={`${label} weight`} type="range" min="0" max="100" step="1" value={weights[key]} onChange={(event) => setWeight(key, Number(event.target.value))}/><span className={styles.rangeEnds}><small>0</small><small>100</small></span><small>{hint}</small></label>)}</div>
      {!validWeights && <p className={styles.validation} role="status">Weights must be whole numbers totaling 100 before saving.</p>}
    </section>
    <section className={styles.section} aria-labelledby="ratings-heading">
      <div className={styles.sectionHeader}><SlidersHorizontal aria-hidden="true" /><div><h2 id="ratings-heading">Opportunity ratings</h2><p>Rate each opportunity from 1 (low) to 5 (high) on each factor. Scores update as you edit.</p></div><div className={styles.filters}><label><span className={styles.srOnly}>Filter opportunities by category</span><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter opportunities by category">{growthCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label className={styles.search}><Search size={16} aria-hidden="true" /><span className={styles.srOnly}>Search opportunities</span><input type="search" placeholder="Search opportunities..." value={search} onChange={(event) => setSearch(event.target.value)}/></label></div></div>
      <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.srOnly}>Opportunity ratings. {visible.length} results.</caption><thead><tr><th scope="col">#</th><th scope="col">Opportunity</th><th scope="col">Category</th>{dimensions.map(({ key, label, icon: Icon }) => <th scope="col" key={key}><Icon size={15} aria-hidden="true" />{label === "Strategic alignment" ? "Alignment" : label}</th>)}<th scope="col">Total score</th><th scope="col">Action</th></tr></thead><tbody>{visible.map((item, index) => { const rating = scores[item.slug] ?? item.score; const priority = calculateGrowthPriority(rating, weights); return <tr key={item.slug}><td className={styles.rank}>#{index + 1}</td><td className={styles.opportunity}><Link href={`/growth/opportunities/${item.slug}`}>{item.title}</Link><small>{item.summary}</small></td><td><span className={`${styles.category} ${styles[item.category.toLowerCase().replaceAll(" ", "")]}`}>{item.category}</span></td>{dimensions.map(({ key, label }) => <td key={key}><input aria-label={`${item.title} ${label} rating`} className={`${styles.rating} ${key === "effort" || key === "cost" || key === "risk" ? (rating[key] <= 2 ? styles.good : rating[key] >= 4 ? styles.poor : styles.medium) : (rating[key] >= 4 ? styles.good : rating[key] <= 2 ? styles.poor : styles.medium)}`} type="number" min="1" max="5" step="1" value={rating[key]} onChange={(event) => setRating(item.slug, key, Number(event.target.value))}/></td>)}<td><span className={`${styles.preview} ${priority >= 80 ? styles.top : priority >= 65 ? styles.mid : styles.low}`}><strong>{priority}</strong><small>{growthPriorityLabel(priority)}</small></span></td><td><Link className={styles.rowLink} href={`/growth/opportunities/${item.slug}`} aria-label={`View ${item.title}`}><ArrowRight size={16}/></Link></td></tr>; })}</tbody></table>{visible.length === 0 && <div className={styles.noResults}><p>No opportunities match these filters.</p><button type="button" onClick={() => { setCategory("All opportunities"); setSearch(""); }}>Clear filters</button></div>}</div>
    </section>
    <div className={styles.bottomCards}>
      <section><Lightbulb aria-hidden="true" /><div><h2>Need help setting weights?</h2><p>Restore the recommended starting weights, then adjust them for your goals.</p><button type="button" onClick={() => { setWeights({ ...growthScoreWeights }); setMessage("Recommended weights restored. Save changes to apply them."); }}>Use recommended weights <ArrowRight size={16}/></button></div></section>
      <section><Users aria-hidden="true" /><div><h2>Keep it consistent</h2><p>These settings apply to everyone in your organization and keep scoring fair and transparent.</p><Link href="/growth/priorities">Learn more about scoring <ArrowRight size={16}/></Link></div></section>
      <section><BarChart3 aria-hidden="true" /><div><h2>Turn scores into action</h2><p>Once scored, create action plans and track progress toward measurable results.</p><Link href="/growth">View top opportunities <ArrowRight size={16}/></Link></div></section>
    </div>
    <div className={styles.saveFooter}><p className={message.includes("saved") ? styles.success : styles.message} role="status" aria-live="polite">{message}</p><button type="button" className={styles.saveButton} onClick={submit} disabled={saving || !validWeights || !validScores}><Save size={16}/>Save changes</button></div>
  </div>;
}
