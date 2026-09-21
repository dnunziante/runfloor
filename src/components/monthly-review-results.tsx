"use client";

import { BarChart3 } from "lucide-react";
import { useState } from "react";
import styles from "@/app/executive/review/review.module.css";

export function MonthlyReviewResults({ wins, risks, outcomes }: { wins: readonly string[]; risks: string[]; outcomes: string[] }) {
  const [tab, setTab] = useState<"working" | "risks">("working");
  const items = tab === "working" ? [...outcomes, ...wins] : risks;
  return <div className={styles.results}><div className={styles.resultTabs} role="tablist" aria-label="Verified result category"><button type="button" role="tab" aria-selected={tab === "working"} onClick={() => setTab("working")}>What’s Working</button><button type="button" role="tab" aria-selected={tab === "risks"} onClick={() => setTab("risks")}>Key Risks</button></div><div role="tabpanel">{items.length ? <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : <div className={styles.emptyDetail}><BarChart3 size={48}/><strong>{tab === "working" ? "No results recorded yet" : "No key risks recorded"}</strong><p>{tab === "working" ? "Add measured outcomes to show progress over time." : "No high-severity risks exceed the configured limit."}</p></div>}</div></div>;
}
