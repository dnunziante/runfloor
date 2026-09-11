"use client";

import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { LocationSummary } from "@/lib/executive/data";

export function ExecutiveLocationTools({ locations, reportingPeriod }: { locations: LocationSummary[]; reportingPeriod: string }) {
  const [query, setQuery] = useState("");
  const [signal, setSignal] = useState("All statuses");
  const filtered = useMemo(() => locations.filter((item) => item.location.toLowerCase().includes(query.toLowerCase())).filter((item) => signal === "All statuses" || item.signal === signal), [locations, query, signal]);
  function exportLocations() {
    const rows = [["Location","Sales pace","Coaching","Growth","Operations","Open risks","Status"], ...filtered.map((item) => [item.location,item.salesPace ?? "",item.coachingCompletion ?? "",item.growthCompletion ?? "",item.operationsCompletion ?? "",item.openRisks,item.signal])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"','""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = `location-performance-${reportingPeriod}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return <section className="exec-card exec-locations" id="locations"><header><div><h2>Location Performance</h2><p>Compare dealership performance across key metrics.</p></div><div className="exec-location-tools"><label><Search/><span className="sr-only">Search locations</span><input placeholder="Search locations" value={query} onChange={(event) => setQuery(event.target.value)}/></label><select aria-label="Filter by status" value={signal} onChange={(event) => setSignal(event.target.value)}><option>All statuses</option><option>Leading</option><option>Stable</option><option>Needs attention</option><option>No data</option></select><button type="button" onClick={exportLocations}><Download/>Export</button></div></header>{filtered.length ? <div className="exec-table-wrap"><table><thead><tr><th>Location</th><th>Sales pace</th><th>Coaching</th><th>Growth</th><th>Operations</th><th>Open risks</th><th>Status</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.location}><td><strong>{item.location}</strong></td><td>{item.salesPace === null ? "—" : `${item.salesPace}%`}</td><td>{item.coachingCompletion === null ? "—" : `${item.coachingCompletion}%`}</td><td>{item.growthCompletion === null ? "—" : `${item.growthCompletion}%`}</td><td>{item.operationsCompletion === null ? "—" : `${item.operationsCompletion}%`}</td><td>{item.openRisks}</td><td><span className={`exec-status ${item.signal.toLowerCase().replaceAll(" ","-")}`}>{item.signal}</span></td></tr>)}</tbody></table></div> : <p className="exec-empty">No locations match these filters.</p>}</section>;
}
