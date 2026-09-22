"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, BarChart3, CalendarDays, Check, CheckCircle2, DollarSign, List, LockKeyhole, MapPin, RotateCcw, ShieldCheck, Target, TrendingUp, Users } from "lucide-react";
import { saveSalesResult } from "@/app/admin/sales-results/actions";
import type { SalesResultsWorkspace } from "@/lib/sales/results";
import styles from "./rv-sales-results-manager.module.css";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
type Values = { revenueTarget: number; revenueActual: number; unitsTarget: number; unitsActual: number; leads: number; appointments: number; notes: string };
const emptyValues: Values = { revenueTarget: 0, revenueActual: 0, unitsTarget: 0, unitsActual: 0, leads: 0, appointments: 0, notes: "" };
const fields = [
  { key: "revenueTarget", label: "Revenue target", help: "Target revenue for this month", icon: DollarSign, tone: "orange" },
  { key: "revenueActual", label: "Revenue actual", help: "Actual revenue achieved", icon: BarChart3, tone: "green" },
  { key: "unitsTarget", label: "Unit target", help: "Target units to sell", icon: Target, tone: "red" },
  { key: "unitsActual", label: "Units actual", help: "Actual units sold", icon: TrendingUp, tone: "teal" },
  { key: "leads", label: "Leads", help: "Total leads generated", icon: Users, tone: "orange" },
  { key: "appointments", label: "Appointments", help: "Total appointments booked", icon: CalendarDays, tone: "red" },
] as const;

export function RvSalesResultsManager({ workspace }: { workspace: SalesResultsWorkspace }) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(workspace.locations[0]?.id ?? "");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [values, setValues] = useState<Values>(emptyValues);
  const [status, setStatus] = useState<"draft" | "approved">("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(workspace.error);
  const [notice, setNotice] = useState("");
  const selectedResults = workspace.results.filter((result) => result.locationId === locationId);
  const ready = Boolean(locationId && period && fields.every(({ key }) => Number.isFinite(values[key]) && values[key] >= 0));

  function clear() { setValues(emptyValues); setStatus("draft"); setError(""); setNotice(""); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const result = await saveSalesResult({ locationId, periodStart: `${period}-01`, ...values, status });
      if (result.error) { setError(result.error); return; }
      setNotice(workspace.persistence === "demo" ? "Result updated for this demo view." : status === "approved" ? "Sales result approved." : "Draft saved.");
      router.refresh();
    } catch { setError("The sales result could not be saved. Try again."); }
    finally { setSaving(false); }
  }

  return <div className={styles.page}>
    <section className={styles.hero}><div><span>Administrator data source</span><h1>Approve monthly <br/>sales <em>results.</em></h1><p>Enter verified location results. Only approved records feed the Executive Advisor.</p></div><blockquote>Same Roads.<br/>Bigger Results.</blockquote></section>
    <div className={styles.body}>
      <div className={styles.columns}>
        <form className={styles.panel} onSubmit={submit}><header><span className={styles.headIcon}><LockKeyhole/></span><div><h2>Monthly location result</h2><p>Enter verified results for the selected location and month.</p></div></header>
          <div className={styles.fields}><label>Location<span className={styles.control}><MapPin/><select required value={locationId} onChange={(event) => setLocationId(event.target.value)}>{workspace.locations.length ? workspace.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>) : <option value="">No locations available</option>}</select></span></label><label>Reporting month<span className={styles.control}><CalendarDays/><input required type="month" value={period} onChange={(event) => setPeriod(event.target.value)}/></span></label>
            {fields.map(({ key, label, help, icon: Icon, tone }) => <label key={key}>{label}<span className={styles.numeric}><span className={styles[tone]}><Icon/></span><input min="0" step={key.startsWith("revenue") ? "0.01" : "1"} required type="number" value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: Number(event.target.value) }))}/></span><small>{help}</small></label>)}
            <label className={styles.wide}>Verification note <span className={styles.optional}>(optional)</span><textarea maxLength={500} placeholder="Add any notes about data source, adjustments, or context..." value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}/><small className={styles.counter}>{values.notes.length}/500</small></label>
            <label className={styles.wide}>Record status<select value={status} onChange={(event) => setStatus(event.target.value as "draft" | "approved")}><option value="draft">Draft</option><option value="approved">Approved</option></select><small>Drafts stay private; approved results feed Executive reporting.</small></label></div>
          {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.success} role="status"><CheckCircle2 size={16}/>{notice}</p>}
          <footer><button className={styles.save} disabled={saving || !ready} type="submit"><LockKeyhole size={16}/>{saving ? "Saving..." : "Save monthly result"}</button><button className={styles.clear} type="button" onClick={clear}><RotateCcw size={16}/>Clear form</button></footer></form>
        <div className={styles.aside}><section className={styles.panel}><header><span className={styles.headIcon}><List/></span><div><h2>Recorded results</h2></div><Link href="/admin/sales-results/quality">View all <ArrowRight size={16}/></Link></header><div className={styles.resultBox}>{selectedResults.length ? selectedResults.map((result) => <article key={result.id}><div><strong>{result.locationName}</strong><small>{new Date(`${result.periodStart.slice(0, 7)}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })} · {result.status === "approved" ? "Approved" : "Draft"}</small></div><span>{money.format(result.revenueActual)} <small>of {money.format(result.revenueTarget)}</small></span></article>) : <div className={styles.empty}><BarChart3/><h3>No results recorded yet</h3><p>Submit your first monthly result to see history here.</p></div>}</div></section>
          <section className={styles.panel}><header><span className={`${styles.headIcon} ${styles.greenIcon}`}><ShieldCheck/></span><div><h2>Data quality</h2></div><Link href="/admin/sales-results/quality">Review quality <ArrowRight size={16}/></Link></header><div className={ready ? styles.qualityReady : styles.qualityPending}><span>{ready ? <Check/> : <Target/>}</span><div><strong>{ready ? "Ready to submit" : "Select a location"}</strong><p>{ready ? "All required fields look good." : "Choose a location and enter the monthly figures."}</p></div></div></section>
          <section className={`${styles.panel} ${styles.impact}`}><header><span className={`${styles.headIcon} ${styles.impactIcon}`}><BarChart3/></span><h2>Your data drives<br/>bigger opportunities.</h2></header><p>Accurate, consistent reporting powers leadership insights and smarter decisions.</p><ul><li><Check/>Supports Executive reporting</li><li><Check/>Tracks location performance</li><li><Check/>Builds accountability</li><li><Check/>Drives growth across your RV network</li></ul><blockquote>“Real data.<br/>Real progress.<br/>More adventures.”<small>— RunFloor</small></blockquote></section></div>
      </div>
    </div>
  </div>;
}
