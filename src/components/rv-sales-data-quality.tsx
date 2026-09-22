"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, BookOpen, Building2, CalendarDays, Check, CheckCircle2, Clock3, Download, FilePenLine, Filter, Search, Target, Upload } from "lucide-react";
import { ReportingPeriodSelector } from "@/components/reporting-period-selector";
import type { SalesDataQualityRow, SalesDataQualityStatus, SalesDataQualityWorkspace } from "@/lib/sales/results";
import styles from "./rv-sales-data-quality.module.css";

const statusNames: Record<SalesDataQualityStatus, string> = { approved: "Approved", draft: "Draft", missing: "Missing", outdated: "Outdated" };
const statusIcons = { approved: CheckCircle2, draft: FilePenLine, missing: AlertTriangle, outdated: Clock3 } as const;
const descriptions = { approved: "Ready for leadership reporting", draft: "Awaiting administrator approval", missing: "No result recorded", outdated: "Using an older reporting month" } as const;
function month(value: string) { return new Date(`${value.slice(0, 7)}-01T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }); }
function revenueRatio(row: SalesDataQualityRow) { return row.result && row.result.revenueTarget > 0 ? Math.round(row.result.revenueActual / row.result.revenueTarget * 100) : null; }
function csvCell(value: string | number) { const text = String(value); const safe = /^[=+@-]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; }

export function RvSalesDataQuality({ workspace }: { workspace: SalesDataQualityWorkspace }) {
  const [filter, setFilter] = useState<"all" | SalesDataQualityStatus>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "status">("name");
  const [showSort, setShowSort] = useState(false);
  const total = workspace.quality.length;
  const readiness = total ? Math.round(workspace.counts.approved / total * 100) : 0;
  const rows = workspace.quality.filter((row) => (filter === "all" || row.status === filter) && row.locationName.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "name" ? a.locationName.localeCompare(b.locationName) : a.status.localeCompare(b.status) || a.locationName.localeCompare(b.locationName));

  function exportRows(items: SalesDataQualityRow[]) {
    const lines = [["Location", "Status", "Selected month", "Latest record", "Revenue actual", "Revenue target", "Revenue to target (%)"], ...items.map((row) => [row.locationName, statusNames[row.status], month(row.periodStart), row.latestPeriod ? month(row.latestPeriod) : "", row.result?.revenueActual ?? "", row.result?.revenueTarget ?? "", revenueRatio(row) ?? ""])];
    const csv = lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `sales-data-quality-${workspace.reportingPeriod}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className={styles.page}>
    <section className={styles.hero}><div><span>Administrator review</span><h1>Confirm reporting<br/><em>readiness.</em></h1><p>See which locations are approved, still in draft, missing,<br/>or relying on an older reporting month.</p></div><blockquote>“Reliable data<br/>powers bigger<br/>opportunities.”<small>— RunFloor</small></blockquote><div className={styles.motto}>Same Roads.<br/>Bigger Results.</div><a href="#quality-guide"><BookOpen size={17}/>Learn about data quality</a></section>
    <div className={styles.body}>
      {workspace.error && <p className={styles.error} role="alert">{workspace.error}</p>}
      <div className={styles.overview}><div className={styles.period}><span className={styles.periodIcon}><CalendarDays/></span><ReportingPeriodSelector action="/admin/sales-results/quality" periods={workspace.availablePeriods} selected={workspace.reportingPeriod}/></div><div className={styles.readiness}><span className={styles.readyIcon}><Check/></span><div><strong>Overall readiness</strong><small>Locations ready for reporting</small><div className={styles.progress}><i style={{ width: `${readiness}%` }}/></div></div><b>{readiness}%</b><button type="button" onClick={() => exportRows(workspace.quality)}><Download size={17}/>Download report</button></div></div>
      <section className={styles.metrics} aria-label="Sales data quality summary">{(["approved", "draft", "missing", "outdated"] as const).map((status) => { const Icon = statusIcons[status]; return <button className={`${styles.metric} ${styles[status]}`} type="button" key={status} onClick={() => setFilter(status)} aria-label={`Show ${statusNames[status].toLowerCase()} locations`}><span className={styles.metricIcon}><Icon/></span><span><strong>{statusNames[status]}</strong><small>{descriptions[status]}</small><b>{workspace.counts[status]}</b><small>{total ? Math.round(workspace.counts[status] / total * 100) : 0}% of locations</small></span></button>; })}</section>
      <div className={styles.toolbar}><div className={styles.tabs} role="group" aria-label="Filter locations by status">{(["all", "approved", "draft", "missing", "outdated"] as const).map((status) => <button type="button" className={filter === status ? styles.active : ""} key={status} onClick={() => setFilter(status)}>{status === "all" ? "All Locations" : statusNames[status]} ({status === "all" ? total : workspace.counts[status]})</button>)}</div><div className={styles.tools}><label className={styles.search}><Search size={16}/><input aria-label="Search locations" placeholder="Search locations..." value={query} onChange={(event) => setQuery(event.target.value)}/></label><div className={styles.sortWrap}><button type="button" onClick={() => setShowSort((value) => !value)} aria-expanded={showSort}><Filter size={16}/>Filter</button>{showSort && <label className={styles.sortMenu}>Sort by<select value={sort} onChange={(event) => setSort(event.target.value as "name" | "status")}><option value="name">Location name</option><option value="status">Status</option></select></label>}</div><button type="button" onClick={() => exportRows(rows)}><Upload size={16}/>Export</button></div></div>
      <div className={styles.tableScroll}><table><thead><tr><th>Location</th><th>Status</th><th>Selected month</th><th>Latest record</th><th>Revenue to target</th><th>Action</th></tr></thead><tbody>{rows.map((row) => { const ratio = revenueRatio(row); return <tr key={row.locationId}><td><span className={styles.building}><Building2 size={16}/></span><strong>{row.locationName}</strong></td><td><span className={`${styles.badge} ${styles[row.status]}`}>{statusNames[row.status]}</span></td><td>{month(row.periodStart)}</td><td>{row.latestPeriod ? month(row.latestPeriod) : "—"}</td><td><div className={styles.revenue}><span className={styles.track}><i className={styles[row.status]} style={{ width: `${Math.min(ratio ?? 0, 100)}%` }}/></span><strong>{ratio === null ? "—" : `${ratio}%`}</strong></div></td><td><Link className={row.status === "missing" ? styles.primaryAction : styles.action} href={row.status === "approved" ? `/admin/sales-results?period=${workspace.reportingPeriod}` : "/admin/sales-results"}>{row.status === "missing" ? "Enter result" : row.status === "draft" ? "Continue" : row.status === "outdated" ? "Update" : "View"}<ArrowRight size={14}/></Link></td></tr>; })}</tbody></table>{!rows.length && <p className={styles.empty}>No locations match this view.</p>}</div>
      <section className={styles.cta}><span><BarChart3/></span><div><h2>Clean data. Confident leadership. Bigger results.</h2><p>Keep your locations up to date and ensure accurate Executive reporting.</p></div><Link href="/admin/sales-results">Resolve missing data <ArrowRight size={18}/></Link></section>
      <section id="quality-guide" className={styles.guide}><Target size={18}/><p><strong>How status is determined:</strong> A location is approved or in draft when it has a result for the selected month. An older record is marked outdated; a location with no result is missing. Only approved results feed Executive reporting.</p></section>
    </div>
  </div>;
}
