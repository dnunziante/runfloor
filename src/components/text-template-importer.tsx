"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, FileText, Import, LoaderCircle, Trash2, X } from "lucide-react";
import type { ImportedTextTemplate } from "@/lib/sales/text-template-import";

type Mode = "spreadsheet" | "document";
type Draft = ImportedTextTemplate & { selected: boolean };

export function TextTemplateImporter({ contentType }: { contentType: "text_template" | "email_template" }) {
  const isEmail = contentType === "email_template";
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [mode, setMode] = useState<Mode>("spreadsheet"), [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]), [source, setSource] = useState(""), [error, setError] = useState(""), [summary, setSummary] = useState("");
  const [strategy, setStrategy] = useState<"skip" | "replace" | "new">("skip");
  const reset = (nextMode = mode) => { setMode(nextMode); setDrafts([]); setSource(""); setError(""); setSummary(""); if (inputRef.current) inputRef.current.value = ""; };
  const close = () => { setOpen(false); reset(); };

  const downloadCsv = () => {
    const value = `Title,Content,Category,Status,Tags\r\nFirst Contact,${isEmail ? "Hi {{first_name}},\\n\\nThank you for your interest..." : "Hi {{first_name}}..."},Lead Follow-Up,Draft,first contact;lead`;
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([value], { type: "text/csv" })); link.download = `runfloor-${isEmail ? "email" : "text"}-template-import.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  const downloadExcel = async () => {
    const XLSX = await import("xlsx"); const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([["Title", "Content", "Category", "Status", "Tags"], ["First Contact", "Hi {{first_name}}...", "Lead Follow-Up", "Draft", "first contact; lead"]]);
    XLSX.utils.book_append_sheet(book, sheet, isEmail ? "Email Templates" : "Text Templates"); XLSX.writeFile(book, `runfloor-${isEmail ? "email" : "text"}-template-import.xlsx`);
  };
  const analyze = async () => {
    const file = inputRef.current?.files?.[0]; if (!file) return setError("Choose a file to continue.");
    setBusy(true); setError(""); const form = new FormData(); form.set("file", file); form.set("mode", mode); form.set("contentType", contentType);
    const response = await fetch("/api/admin/content/text-template-import", { method: "POST", body: form }); const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setError(data.error || "The file could not be processed.");
    setSource(data.sourceText || ""); setDrafts((data.templates || []).map((item: ImportedTextTemplate) => ({ ...item, selected: Boolean(item.title && item.content) })));
  };
  const update = (index: number, values: Partial<Draft>) => setDrafts((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item));
  const importSelected = async () => {
    const selected = drafts.filter((item) => item.selected); if (!selected.length) return setError("Select at least one valid template.");
    setBusy(true); setError(""); const response = await fetch("/api/admin/content/text-template-import", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templates: selected, duplicateStrategy: strategy, contentType }) }); const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setError(data.error || "The templates could not be imported.");
    setSummary(`${data.imported} imported · ${data.replaced} replaced · ${data.skipped} skipped · ${data.drafts} left as drafts`); router.refresh();
  };
  const valid = drafts.filter((item) => item.title.length >= 2 && item.content.length >= 2).length, duplicates = drafts.filter((item) => item.duplicateId).length;

  return <>
    <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}><Import size={16} /> Import templates</button>
    {open && <div className="template-import-backdrop" role="presentation"><section aria-labelledby="template-import-title" aria-modal="true" className="template-import-modal" role="dialog">
      <header><div><span className="badge amber">{isEmail ? "Email" : "Text"} templates</span><h2 id="template-import-title">Import templates</h2><p>Upload a structured file or extract customer-facing {isEmail ? "emails" : "messages"} from a document.</p></div><button aria-label="Close importer" className="icon-btn" onClick={close} type="button"><X /></button></header>
      {!drafts.length ? <div className="template-import-start">
        <div className="template-import-tabs"><button className={mode === "spreadsheet" ? "active" : ""} onClick={() => reset("spreadsheet")} type="button"><FileSpreadsheet />Upload spreadsheet<small>Excel or CSV</small></button><button className={mode === "document" ? "active" : ""} onClick={() => reset("document")} type="button"><FileText />Extract from document<small>PDF, DOCX, or TXT</small></button></div>
        {mode === "spreadsheet" && <div className="template-downloads"><span>Start with a prepared file:</span><button onClick={downloadExcel} type="button"><Download /> Download Excel template</button><button onClick={downloadCsv} type="button"><Download /> Download CSV template</button></div>}
        <label className="template-file-drop"><input ref={inputRef} accept={mode === "spreadsheet" ? ".xlsx,.csv" : ".pdf,.docx,.txt"} type="file" /><strong>Choose {mode === "spreadsheet" ? "an Excel or CSV file" : "a PDF, DOCX, or TXT file"}</strong><span>Maximum file size: 10 MB</span></label>
        {error && <p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy} onClick={analyze} type="button">{busy ? <LoaderCircle className="spin" /> : mode === "document" ? <FileText /> : <FileSpreadsheet />}{busy ? "Processing…" : mode === "document" ? "Extract templates" : "Review spreadsheet"}</button>
      </div> : <div className="template-import-review">
        <div className="template-import-metrics"><div><strong>{drafts.length}</strong><span>Templates detected</span></div><div><strong>{valid}</strong><span>Valid templates</span></div><div><strong>{drafts.length - valid}</strong><span>Needs review</span></div><div><strong>{duplicates}</strong><span>Potential duplicates</span></div></div>
        <div className={source ? "template-review-split" : ""}>{source && <aside><h3>Extracted source text</h3><pre>{source}</pre></aside>}<div className="template-draft-list">
          <div className="template-review-toolbar"><div><button type="button" onClick={() => setDrafts((items) => items.map((item) => ({ ...item, selected: true })))}>Select all</button><button type="button" onClick={() => setDrafts((items) => items.map((item) => ({ ...item, selected: false })))}>Deselect all</button></div>{duplicates > 0 && <label>Duplicates<select value={strategy} onChange={(event) => setStrategy(event.target.value as typeof strategy)}><option value="skip">Skip existing</option><option value="replace">Replace existing</option><option value="new">Import as new</option></select></label>}</div>
          {drafts.map((item, index) => <article className="template-draft-card" key={item.clientId}><div className="template-draft-head"><label><input checked={item.selected} onChange={(event) => update(index, { selected: event.target.checked })} type="checkbox" /> Include</label>{item.duplicateReason && <span className="badge amber">{item.duplicateReason}</span>}<button aria-label={`Remove ${item.title || "template"}`} onClick={() => setDrafts((items) => items.filter((_, itemIndex) => itemIndex !== index))} type="button"><Trash2 /></button></div><label>Title<input value={item.title} onChange={(event) => update(index, { title: event.target.value })} /></label><label>Content<textarea rows={4} value={item.content} onChange={(event) => update(index, { content: event.target.value })} /></label><div className="template-draft-fields"><label>Category<input value={item.category} onChange={(event) => update(index, { category: event.target.value })} /></label><label>Status<select value={item.status} onChange={(event) => update(index, { status: event.target.value as Draft["status"] })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label>Tags<input value={item.tags.join(", ")} onChange={(event) => update(index, { tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} /></label></div></article>)}
        </div></div>
        {error && <p className="form-error" role="alert">{error}</p>}{summary && <p className="form-success" role="status">{summary}</p>}<footer><button className="btn btn-secondary" onClick={() => reset(mode)} type="button">Choose another file</button><button className="btn btn-primary" disabled={busy || !drafts.some((item) => item.selected)} onClick={importSelected} type="button">{busy ? <LoaderCircle className="spin" /> : <Import />}{busy ? "Importing…" : "Import selected templates"}</button></footer>
      </div>}
    </section></div>}
  </>;
}
