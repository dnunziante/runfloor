"use client";

import { useState } from "react";

type Candidate = {
  name: string; model: string; manufacturer: string; modelYear: number | null; modelVariant: string; productCategory: string; productType: string; description: string;
  specifications: Record<string, string>; duplicateId: string | null; selected: boolean; action: "create" | "update" | "skip";
};

function fieldLabel(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function TemplateProductImporter({ templateId }: { templateId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState("");
  const [items, setItems] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const update = (index: number, changes: Partial<Candidate>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));

  async function extract(form: HTMLFormElement) {
    if (!file) return;
    setBusy(true); setError(""); setNotice("");
    const body = new FormData(form); body.set("mode", "extract"); body.set("file", file);
    try {
      const response = await fetch(`/api/admin/platform/templates/${templateId}/starter-products/import`, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Extraction failed.");
      const candidates = (data.candidates || []).map((item: Omit<Candidate, "selected" | "action">) => ({ ...item, selected: !item.duplicateId, action: item.duplicateId ? "skip" : "create" }));
      setImportId(data.importId || ""); setItems(candidates);
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
    <div><h2>Extract products from documents</h2><p>Upload comparison sheets, brochures, PDFs, images, or spreadsheets. Detected models are added to this workspace for review.</p></div>
    {!items.length ? <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void extract(event.currentTarget); }}>
      <div className="grid grid-2">
        <label><span className="label">Source document</span><input className="input" type="file" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.csv" required onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <label><span className="label">Product destination</span><select className="input" name="productType" defaultValue="our_product"><option value="our_product">My Products</option><option value="competitor_product">Competitor Products</option></select></label>
      </div>
      <div className="grid grid-3"><input className="input" name="manufacturer" placeholder="Manufacturer (optional)" /><input className="input" name="model" placeholder="Model (optional)" /><button className="btn btn-primary" disabled={busy}>{busy ? "Extracting…" : "Extract and add for review"}</button></div>
    </form> : <div className="form-stack">
      <div className="row-between"><div><h3>Review extracted products</h3><p>Confirm each model before it is added to this template. Possible duplicates are skipped unless you choose to update them.</p></div><button className="btn btn-primary" type="button" disabled={busy} onClick={() => void approve()}>{busy ? "Saving…" : "Add selected starter products"}</button></div>
      {items.map((item, index) => <details className="card" key={`${item.model}-${index}`} open><summary><input type="checkbox" checked={item.selected} onChange={(event) => update(index, { selected: event.target.checked })} onClick={(event) => event.stopPropagation()} /> {item.name || "Unnamed product"}{item.duplicateId ? " · Possible duplicate" : ""}</summary><div className="form-stack" style={{ marginTop: 14 }}><div className="grid grid-3"><input className="input" value={item.name} onChange={(event) => update(index, { name: event.target.value })} placeholder="Product Name" /><input className="input" value={item.model} onChange={(event) => update(index, { model: event.target.value })} placeholder="Model" /><input className="input" value={item.manufacturer} onChange={(event) => update(index, { manufacturer: event.target.value })} placeholder="Manufacturer" /><input className="input" value={item.modelVariant} onChange={(event) => update(index, { modelVariant: event.target.value })} placeholder="Product Line / Series" /><input className="input" type="number" value={item.modelYear || ""} onChange={(event) => update(index, { modelYear: Number(event.target.value) || null })} placeholder="Model Year" /><input className="input" value={item.productCategory} onChange={(event) => update(index, { productCategory: event.target.value })} placeholder="Category" /><select className="input" value={item.productType} onChange={(event) => update(index, { productType: event.target.value })}><option value="our_product">My Products</option><option value="competitor_product">Competitor Products</option></select>{item.duplicateId ? <select className="input" value={item.action} onChange={(event) => update(index, { action: event.target.value as Candidate["action"] })}><option value="skip">Skip duplicate</option><option value="update">Update existing</option></select> : null}</div><textarea className="input" value={item.description} onChange={(event) => update(index, { description: event.target.value })} placeholder="Description" />{Object.keys(item.specifications).length ? <div className="grid grid-3">{Object.entries(item.specifications).map(([key, value]) => <label key={key}><span className="label">{fieldLabel(key)}</span><input className="input" value={value} onChange={(event) => update(index, { specifications: { ...item.specifications, [key]: event.target.value } })} /></label>)}</div> : null}<button className="text-button" type="button" onClick={() => update(index, { selected: false, action: "skip" })}>Remove from approval</button></div></details>)}
    </div>}
    {notice ? <p>{notice}</p> : null}{error ? <p className="form-error">{error}</p> : null}
  </section>;
}
