"use client";

import Link from "next/link";
import { ArrowRight, ArrowUp, Crosshair, DollarSign, Plus, Search, Settings, ShieldAlert, Target, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { calculateGrowthPriority, growthCategories, growthPriorityLabel, type GrowthOpportunity, type GrowthScore, type GrowthScoreWeights } from "@/lib/growth/data";
import styles from "@/app/growth/priorities/priorities.module.css";

const dimensions = [
  { key: "impact", label: "Impact", icon: ArrowUp, inverse: false },
  { key: "effort", label: "Effort", icon: Settings, inverse: true },
  { key: "confidence", label: "Confidence", icon: Users, inverse: false },
  { key: "cost", label: "Cost", icon: DollarSign, inverse: true },
  { key: "risk", label: "Risk", icon: ShieldAlert, inverse: true },
  { key: "alignment", label: "Alignment", icon: Crosshair, inverse: false },
] as const;
type Dimension = keyof GrowthScore;
type SortMode = "priorityDesc" | "priorityAsc" | "name" | "dimension";

export function GrowthPriorityTable({ opportunities, weights, canEdit = false }: { opportunities: GrowthOpportunity[]; weights: GrowthScoreWeights; canEdit?: boolean }) {
  const [category, setCategory] = useState("All opportunities");
  const [sortMode, setSortMode] = useState<SortMode>("priorityDesc");
  const [dimension, setDimension] = useState<Dimension>("impact");
  const [descending, setDescending] = useState(true);
  const sorted = useMemo(() => opportunities.filter((item) => category === "All opportunities" || item.category === category).sort((a, b) => {
    if (sortMode === "name") return a.title.localeCompare(b.title);
    if (sortMode === "dimension") return (b.score[dimension] - a.score[dimension]) * (descending ? 1 : -1) || calculateGrowthPriority(b.score, weights) - calculateGrowthPriority(a.score, weights);
    const delta = calculateGrowthPriority(b.score, weights) - calculateGrowthPriority(a.score, weights);
    return sortMode === "priorityAsc" ? -delta : delta;
  }), [category, descending, dimension, opportunities, sortMode, weights]);

  function sortDimension(key: Dimension) { setDescending(sortMode === "dimension" && dimension === key ? !descending : true); setDimension(key); setSortMode("dimension"); }

  return <section className={styles.ranking} aria-labelledby="ranking-title">
    <div className={styles.rankingHeader}><div><h2 id="ranking-title">Ranked opportunities</h2><p>See how each opportunity scores across key factors. Select a score heading to compare.</p></div><div className={styles.controls}><label><span className="sr-only">Filter category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{growthCategories.map((item) => <option key={item} value={item}>{item === "All opportunities" ? "All categories" : item}</option>)}</select></label><label><span className="sr-only">Sort opportunities</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="priorityDesc">Priority: high to low</option><option value="priorityAsc">Priority: low to high</option><option value="name">Opportunity name</option>{sortMode === "dimension" && <option value="dimension">{dimension}: {descending ? "high to low" : "low to high"}</option>}</select></label>{canEdit && <Link href="/admin/growth/opportunities" className={styles.addButton}><Plus size={16} /> Add opportunity</Link>}</div></div>
    <div className={styles.tableScroll}><table className={styles.table}><caption className="sr-only">Opportunity priority scores, filtered by {category}. {sorted.length} results.</caption><thead><tr><th scope="col">#</th><th scope="col">Opportunity</th><th scope="col">Category</th>{dimensions.map(({ key, label, icon: Icon }) => <th scope="col" key={key} aria-sort={sortMode === "dimension" && dimension === key ? descending ? "descending" : "ascending" : undefined}><button type="button" onClick={() => sortDimension(key)} aria-label={`Sort by ${label}${sortMode === "dimension" && dimension === key ? descending ? ", currently high to low" : ", currently low to high" : ""}`}><Icon size={15} aria-hidden="true" />{label}<small>({weights[key]}%)</small></button></th>)}<th scope="col" aria-sort={sortMode === "priorityDesc" ? "descending" : sortMode === "priorityAsc" ? "ascending" : undefined}><button type="button" onClick={() => setSortMode(sortMode === "priorityDesc" ? "priorityAsc" : "priorityDesc")} aria-label="Sort by total score"><Target size={15} aria-hidden="true" />Total score<small>(100)</small></button></th><th scope="col">Action</th></tr></thead><tbody>{sorted.map((item, index) => {
      const total = calculateGrowthPriority(item.score, weights);
      return <tr key={item.slug}><td className={styles.rank}>#{index + 1}</td><td className={styles.name}><strong>{item.title}</strong><small>{item.summary}</small></td><td><span className={`${styles.category} ${styles[item.category.toLowerCase().replaceAll(" ", "")] || ""}`}>{item.category}</span></td>{dimensions.map(({ key, inverse }) => <td key={key}><span className={`${styles.rating} ${(inverse ? item.score[key] <= 2 : item.score[key] >= 5) ? styles.good : (inverse ? item.score[key] >= 5 : item.score[key] <= 2) ? styles.poor : styles.moderate}`}>{item.score[key]}</span></td>)}<td><span className={`${styles.total} ${total >= 80 ? styles.top : total < 65 ? styles.low : styles.middle}`}><strong>{total}</strong><small>{growthPriorityLabel(total)}</small></span></td><td><Link className={styles.detailsButton} href={`/growth/opportunities/${item.slug}`}>View details <ArrowRight size={15} /></Link></td></tr>;
    })}</tbody></table>{!sorted.length && <div className={styles.empty}><Search size={25} /><p>No opportunities in this category.</p><button type="button" onClick={() => setCategory("All opportunities")}>Show all categories</button></div>}</div>
  </section>;
}
