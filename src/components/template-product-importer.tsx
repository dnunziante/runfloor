"use client";

import { useState } from "react";
import { RvCategoryField } from "@/components/rv-category-field";

type Candidate = {
  name: string; model: string; manufacturer: string; modelYear: number | null; modelVariant: string; productCategory: string; productType: string; description: string;
  specifications: Record<string, string | number | boolean | null>; duplicateId: string | null; selected: boolean; action: "create" | "update" | "skip"; warnings: string[]; sourceRow: number | null;
};

function fieldLabel(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function TemplateProductImporter({ templateId, isRv = false }: { templateId: string; isRv?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState("");
  const [items, setItems] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [summary, setSummary] = useState({ totalRows: 0, errors: [] as string[], detectedFormat: "" });
  const update = (index: number, changes: Partial<Candidate>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));

  function downloadTemplate(expanded = false) {
    const expandedRvHeaders = ["model_year", "Manufacturer", "brand", "line", "model", "Description", "model_year_label", "body_type", "dry_weight_lb", "gvwr_lb", "gvwr_derived", "cargo_capacity_lb", "hitch_weight_lb", "hitch_weight_basis", "hitch_kind", "length_ft", "width_ft", "exterior_height_ft", "interior_height_ft", "fresh_water_gal", "grey_water_gal", "black_water_gal", "sleeps", "axles", "slides", "tires", "air_conditioner", "refrigerator", "awning", "primary_bed", "layout", "msrp_usd"];
    const expandedRvExample = ["2021", "Jayco", "Jayco", "Eagle", "317RLOK", "Luxury rear-living fifth wheel", "2021 model", "Fifth Wheel", "11025", "12995", "false", "1970", "2165", "published", "fifth wheel", "36.417", "8.5", "13.25", "", "81", "87", "50", "6", "2", "3", "ST235/80R16", "true", "true", "true", "king", "rear living", "74995"];
    const headers = expanded && isRv ? expandedRvHeaders : isRv
      ? ["Product Name", "Model", "Manufacturer", "Model Year", "RV Type", "Description", "Floorplan", "Shipping Weight", "GVWR", "Length", "Sleeping Capacity", "MSRP"]
      : ["Product Name", "Model", "Manufacturer", "Model Year", "Category", "Description", "Price", "Features"];
    const example = expanded && isRv ? expandedRvExample : isRv
      ? ["Example Travel Trailer", "26BUD", "Example Manufacturer", "2027", "Travel Trailer", "Family-friendly bunkhouse", "26BUD", "6,724 lbs", "8,500 lbs", "29 ft 8 in", "8", "$32,995"]
      : ["Example Product", "MODEL-100", "Example Manufacturer", "2027", "Category", "Short description", "$1,000", "Feature one; Feature two"];
    const csv = [headers, example].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = expanded && isRv ? "rv-expanded-bulk-upload.csv" : `${isRv ? "rv" : "product"}-template-bulk-upload.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function extract(form: HTMLFormElement) {
    if (!file) return;
    setBusy(true); setError(""); setNotice("");
    const body = new FormData(form); body.set("mode", "extract"); body.set("file", file);
    try {
      const response = await fetch(`/api/admin/platform/templates/${templateId}/starter-products/import`, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Extraction failed.");
      const candidates = (data.candidates || []).map((item: Omit<Candidate, "selected" | "action">) => ({ ...item, selected: !item.duplicateId, action: item.duplicateId ? "skip" : "create" }));
      setImportId(data.importId || ""); setItems(candidates); setSummary({ totalRows: data.totalRows || candidates.length, errors: data.errors || [], detectedFormat: data.detectedFormat || "" });
      if (!candidates.length) setNotice("No identifiable product models were found in this document.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Extraction failed."); } finally { setBusy(false); }
  }

  async function approve() {
    setBusy(true); setError("");
    try {
      const candidates = items.map((item) => ({ ...item, action: item.selected ? item.action : "skip" }));
      const body = new FormData(); body.set("mode", "approve"); body.set("importId", importId); body.set("candidates", JSON.stringify(candidates));
      const response = await fetch(`/api/admin/platform/templates/${templateId}/starter-products/import`, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Approval failed.");
      window.location.reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Approval failed."); } finally { setBusy(false); }
  }

  return <section className="card form-stack" style={{ marginTop: 20 }}>
    <div className="row-between"><div><h2>Bulk upload products</h2><p>Import up to 500 rows directly from CSV or Excel, or extract models from a PDF, image, or DOCX. You can review every product before it changes this template.</p></div><div className="button-row"><button className="btn btn-ghost" type="button" onClick={() => downloadTemplate(false)}>Download standard template</button>{isRv ? <button className="btn btn-ghost" type="button" onClick={() => downloadTemplate(true)}>Download expanded RV template</button> : null}</div></div>
    {!items.length ? <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void extract(event.currentTarget); }}>
      <div className="grid grid-2">
        <label><span className="label">Product file</span><input className="input" type="file" accept=".xlsx,.csv,.pdf,.jpg,.jpeg,.png,.docx" required onChange={(event) => setFile(event.target.files?.[0] || null)} /><small className="field-help">For reliable bulk imports, use the CSV template or an Excel sheet with Product Name or Model columns.</small></label>
        <label><span className="label">Product destination</span><select className="input" name="productType" defaultValue="our_product"><option value="our_product">My Products</option><option value="competitor_product">Competitor Products</option></select></label>
      </div>
      <div className="grid grid-3"><input className="input" name="manufacturer" placeholder="Default manufacturer (optional)" /><span/><button className="btn btn-primary" disabled={busy}>{busy ? "Reading product file…" : "Upload and review products"}</button></div>
    </form> : <div className="form-stack">
      <div className="row-between"><div><h3>Review uploaded products</h3><p>{summary.detectedFormat === "expanded" ? "Expanded RV dataset detected." : summary.detectedFormat === "runfloor" ? "RunFloor RV template detected." : "Product document detected."} Possible duplicates require your choice.</p></div><div className="button-row"><button className="btn btn-ghost" type="button" disabled={busy} onClick={() => { setItems([]); setImportId(""); setFile(null); setSummary({ totalRows: 0, errors: [], detectedFormat: "" }); }}>Choose another file</button><button className="btn btn-primary" type="button" disabled={busy || !items.some((item) => item.selected)} onClick={() => void approve()}>{busy ? "Saving…" : `Add ${items.filter((item) => item.selected).length} selected products`}</button></div></div>
      <div className="grid grid-4"><div className="metric-card"><small>Rows detected</small><strong>{summary.totalRows}</strong></div><div className="metric-card"><small>Ready to import</small><strong>{items.filter((item) => item.selected).length}</strong></div><div className="metric-card"><small>With warnings</small><strong>{items.filter((item) => item.warnings.length || item.duplicateId).length}</strong></div><div className="metric-card"><small>With errors</small><strong>{summary.errors.length}</strong></div></div>
      {summary.errors.length ? <div className="form-error" role="alert"><strong>Rows needing correction</strong><ul>{summary.errors.map((message) => <li key={message}>{message}</li>)}</ul></div> : null}
      {items.map((item, index) => <details className="card" key={`${item.model}-${index}`}><summary><input type="checkbox" checked={item.selected} onChange={(event) => update(index, { selected: event.target.checked })} onClick={(event) => event.stopPropagation()} /> {item.name || "Unnamed product"} · {item.manufacturer || "Unknown manufacturer"} · {item.modelYear || "Year not supplied"} · {item.productCategory || "RV type not supplied"} · {Object.values(item.specifications).filter((value) => value !== null && value !== "").length} specifications{item.duplicateId ? " · Possible duplicate" : item.warnings.length ? " · Warning" : ""}</summary><div className="form-stack" style={{ marginTop: 14 }}><div className="grid grid-3"><input className="input" value={item.name} onChange={(event) => update(index, { name: event.target.value })} placeholder="Product Name" /><input className="input" value={item.model} onChange={(event) => update(index, { model: event.target.value })} placeholder="Model" /><input className="input" value={item.manufacturer} onChange={(event) => update(index, { manufacturer: event.target.value })} placeholder="Manufacturer" /><input className="input" value={item.modelVariant} onChange={(event) => update(index, { modelVariant: event.target.value })} placeholder="Product Line / Series" /><input className="input" type="number" value={item.modelYear || ""} onChange={(event) => update(index, { modelYear: Number(event.target.value) || null })} placeholder="Model Year" />{isRv ? <RvCategoryField value={item.productCategory} onValueChange={(productCategory) => update(index, { productCategory })} /> : <input className="input" value={item.productCategory} onChange={(event) => update(index, { productCategory: event.target.value })} placeholder="Category" />}<select className="input" value={item.productType} onChange={(event) => update(index, { productType: event.target.value })}><option value="our_product">My Products</option><option value="competitor_product">Competitor Products</option></select>{item.duplicateId ? <select className="input" value={item.action} onChange={(event) => update(index, { action: event.target.value as Candidate["action"] })}><option value="skip">Skip duplicate</option><option value="update">Update existing</option><option value="create">Import as new</option></select> : null}</div><textarea className="input" value={item.description} onChange={(event) => update(index, { description: event.target.value })} placeholder="Description" />{item.warnings.length ? <div className="notice"><strong>Import warnings</strong><ul>{item.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}{Object.keys(item.specifications).length ? <div className="grid grid-3">{Object.entries(item.specifications).map(([key, value]) => <label key={key}><span className="label">{fieldLabel(key)}</span>{typeof value === "boolean" ? <select className="input" value={String(value)} onChange={(event) => update(index, { specifications: { ...item.specifications, [key]: event.target.value === "true" } })}><option value="true">Yes</option><option value="false">No</option></select> : <input className="input" type={typeof value === "number" ? "number" : "text"} step={typeof value === "number" ? "any" : undefined} value={value ?? ""} onChange={(event) => update(index, { specifications: { ...item.specifications, [key]: typeof value === "number" ? (event.target.value === "" ? null : Number(event.target.value)) : event.target.value } })} />}</label>)}</div> : null}<button className="text-button" type="button" onClick={() => update(index, { selected: false, action: "skip" })}>Remove from approval</button></div></details>)}
    </div>}
    {notice ? <p>{notice}</p> : null}{error ? <p className="form-error">{error}</p> : null}
  </section>;
}
