"use client";

import { useRef, useState } from "react";
import { Car, MessageSquare, PlayCircle, Sparkles } from "lucide-react";
import { AssistantMarkdown } from "@/components/assistant-markdown";
import { comparisonActions, type ComparisonAction } from "@/lib/products/compare-sell";
import { productTitle } from "@/lib/products/presentation";
import type { ProductDTO } from "@/lib/products/types";
import styles from "./compare-sell.module.css";

const actionIcons = { pitch: PlayCircle, objection: MessageSquare, demo: Car };
const responseTitles = { pitch: "30-second pitch", objection: "Objection response", demo: "Side-by-side demo" };
type Answer = { action: ComparisonAction; answer: string; catalog: string; sources: { label: string; title: string }[] };
type Catalog = "workspace" | "shared";

export function CompareSell({ products, catalog, unavailable }: { products: ProductDTO[]; catalog: Catalog; unavailable?: string }) {
  const [notes, setNotes] = useState("");
  const selectionKey = JSON.stringify([catalog, ...products.map(product => product.id)]);

  if (products.length < 2) return null;
  return (
    <section className={`card ${styles.panel}`} aria-label="Compare & Sell">
      <header className={styles.heading}>
        <span className={styles.icon}><Sparkles size={22} aria-hidden="true" /></span>
        <div><h2>Compare &amp; Sell</h2><p>Get sales coaching for the models on this page.</p></div>
      </header>
      <ul className={styles.models} aria-label="Selected models">
        {products.map(product => <li key={product.id}>{productTitle(product)}</li>)}
      </ul>
      {unavailable ? <p className={styles.notice}>{unavailable}</p> : <>
        <label className={styles.notes}>
          <span>What matters most to this customer? <small>(optional)</small></span>
          <input className="input" value={notes} onChange={event => setNotes(event.target.value)} maxLength={500} placeholder="Comfort, space, or budget" />
        </label>
        <CompareSellActions key={selectionKey} products={products} catalog={catalog} notes={notes} />
      </>}
    </section>
  );
}

function CompareSellActions({ products, catalog, notes }: { products: ProductDTO[]; catalog: Catalog; notes: string }) {
  const [pending, setPending] = useState<ComparisonAction | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Answer | null>(null);
  const inFlight = useRef(false);

  async function generate(action: ComparisonAction) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(action);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/assistant/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-RunFloor-AI-Request": crypto.randomUUID() },
        body: JSON.stringify({ productIds: products.map(product => product.id), catalog, action, notes }),
      });
      if (response.redirected) {
        setError("Your session has ended. Sign in again to use Compare & Sell.");
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Compare & Sell could not complete this request.");
        return;
      }
      setResult({ action, answer: data.answer, catalog: data.catalog, sources: data.sources });
    } catch {
      setError("RunFloor could not confirm the result. Check AI Usage before repeating this request.");
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return <>
    <div className={styles.actions}>
      {(Object.keys(comparisonActions) as ComparisonAction[]).map(action => {
        const Icon = actionIcons[action];
        return <button key={action} type="button" className={`btn btn-secondary ${styles.action}`} disabled={pending !== null} onClick={() => void generate(action)}>
          <Icon size={18} aria-hidden="true" />{comparisonActions[action]}
        </button>;
      })}
    </div>
    {pending && <p role="status" className={styles.notice}>Preparing {responseTitles[pending].toLowerCase()}…</p>}
    {error && <p role="alert" className={styles.notice}>{error}</p>}
    {result && <div className={styles.result} aria-live="polite">
      <h3>{responseTitles[result.action]}</h3>
      <div className={styles.answer}><AssistantMarkdown content={result.answer} /></div>
      <p className={styles.sources}>Source: {result.catalog} · {result.sources.map(source => `${source.label} ${source.title}`).join(" · ")}</p>
    </div>}
  </>;
}
