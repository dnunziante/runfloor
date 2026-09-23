"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, FileText, Import, LoaderCircle, Trash2, X } from "lucide-react";
import type { ImportedTextTemplate } from "@/lib/sales/text-template-import";
import type { ManagedContentType } from "@/lib/content/template-pagination";

type Mode = "spreadsheet" | "document";
type Draft = ImportedTextTemplate & { selected: boolean };

export function TextTemplateImporter({ contentType, categories }: { contentType: ManagedContentType; categories: string[] }) {
  const isEmail = contentType === "email_template";
  const isScript = contentType === "sales_script";
  const isObjection = contentType === "objection_response";
  const noun = isScript ? "scripts" : isObjection ? "responses" : "templates";
  const itemName = isScript ? "script" : isObjection ? "response" : "template";
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [mode, setMode] = useState<Mode>("spreadsheet"), [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]), [source, setSource] = useState(""), [error, setError] = useState(""), [summary, setSummary] = useState("");
  const [strategy, setStrategy] = useState<"skip" | "replace" | "new">("skip");
  const [missingCategories, setMissingCategories] = useState<string[]>([]);
  const [createMissingCategories, setCreateMissingCategories] = useState(true);
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});
  const reset = (nextMode = mode) => { setMode(nextMode); setDrafts([]); setSource(""); setError(""); setSummary(""); setMissingCategories([]); setCategoryMappings({}); if (inputRef.current) inputRef.current.value = ""; };
  const close = () => { setOpen(false); reset(); };

  const downloadCsv = () => {
    const value = isObjection ? `response_name,category,tags,objection,response,status\r\nPrice Is Too High,Price,Price; Value,That's more than I wanted to spend.,I understand. Let me show you exactly what is included and where the value difference comes from...,Published` : `${isScript ? "script_name" : "Title"},${isScript ? "content" : "Content"},${isScript ? "category" : "Category"},${isScript ? "status" : "Status"},${isScript ? "tags" : "Tags"}\r\n${isScript ? "First-Time Buyer Discovery" : "First Contact"},${isScript ? "Before we start looking at specific models let me ask a few questions..." : isEmail ? "Hi {{first_name}},\\n\\nThank you for your interest..." : "Hi {{first_name}}..."},${isScript ? "Discovery" : "Lead Follow-Up"},Draft,${isScript ? "first-time buyer; qualification" : "first contact;lead"}`;
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([value], { type: "text/csv" })); link.download = `runfloor-${isEmail ? "email" : "text"}-template-import.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  const downloadExcel = async () => {
    const XLSX = await import("xlsx"); const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(isObjection ? [["response_name", "category", "tags", "objection", "response", "status"], ["Price Is Too High", "Price", "Price; Value", "That's more than I wanted to spend.", "I understand. Let me show you exactly what is included and where the value difference comes from...", "Published"]] : [[isScript ? "script_name" : "Title", "Content", "Category", "Status", "Tags"], [isScript ? "First-Time Buyer Discovery" : "First Contact", isScript ? "Before we start looking at specific models, let me ask a few questions..." : "Hi {{first_name}}...", isScript ? "Discovery" : "Lead Follow-Up", "Draft", isScript ? "first-time buyer; qualification" : "first contact; lead"]]);
    XLSX.utils.book_append_sheet(book, sheet, isScript ? "Sales Scripts" : isObjection ? "Objection Responses" : isEmail ? "Email Templates" : "Text Templates"); XLSX.writeFile(book, `runfloor-${isScript ? "sales-script" : isObjection ? "objection-response" : isEmail ? "email" : "text"}-import.xlsx`);
  };
  const analyze = async () => {
    const file = inputRef.current?.files?.[0]; if (!file) return setError("Choose a file to continue.");
    setBusy(true); setError(""); const form = new FormData(); form.set("file", file); form.set("mode", mode); form.set("contentType", contentType);
    const response = await fetch("/api/admin/content/text-template-import", { method: "POST", body: form }); const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setError(data.error || "The file could not be processed.");
    setSource(data.sourceText || ""); setMissingCategories(data.missingCategories || []); setDrafts((data.templates || []).map((item: ImportedTextTemplate) => ({ ...item, validationIssues: item.validationIssues || [], selected: Boolean(item.title && item.content && !(item.validationIssues || []).length) })));
  };
  const update = (index: number, values: Partial<Draft>) => setDrafts((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item));
  const importSelected = async () => {
    const selected = drafts.filter((item) => item.selected); if (!selected.length) return setError("Select at least one valid template.");
    setBusy(true); setError(""); const response = await fetch("/api/admin/content/text-template-import", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templates: selected, duplicateStrategy: strategy, contentType, createMissingCategories, categoryMappings }) }); const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setError(data.error || "The templates could not be imported.");
    setSummary(`${data.imported} imported · ${data.replaced} replaced · ${data.skipped} skipped · ${data.drafts} left as drafts`); router.refresh();
  };
  const valid = drafts.filter((item) => item.title.length >= 2 && item.content.length >= 2 && !item.validationIssues.length).length, duplicates = drafts.filter((item) => item.duplicateId).length;
  const unresolvedCategories = !createMissingCategories && missingCategories.some((name) => !categoryMappings[name]);

  return <>
    <button className="btn btn-secondary" type="button" onClick={() => setOpen(true)}><Import size={16} /> Import {isScript ? "Scripts" : isObjection ? "Responses" : "templates"}</button>
    {open && <div className="template-import-backdrop" role="presentation"><section aria-labelledby="template-import-title" aria-modal="true" className="template-import-modal" role="dialog">
      <header><div><span className="badge amber">{isScript ? "Sales scripts" : isObjection ? "Objection responses" : `${isEmail ? "Email" : "Text"} templates`}</span><h2 id="template-import-title">Import {noun}</h2><p>{isScript ? "Upload a CSV or Excel file, validate every row, then import approved talk tracks." : isObjection ? "Upload a CSV or Excel file, validate objections and approved responses, then import." : `Upload a structured file or extract customer-facing ${isEmail ? "emails" : "messages"} from a document.`}</p></div><button aria-label="Close importer" className="icon-btn" onClick={close} type="button"><X /></button></header>
      {!drafts.length ? <div className="template-import-start">
        <div className="template-import-tabs"><button className={mode === "spreadsheet" ? "active" : ""} onClick={() => reset("spreadsheet")} type="button"><FileSpreadsheet />Upload spreadsheet<small>Excel or CSV</small></button>{!isScript && !isObjection && <button className={mode === "document" ? "active" : ""} onClick={() => reset("document")} type="button"><FileText />Extract from document<small>PDF, DOCX, or TXT</small></button>}</div>
        {mode === "spreadsheet" && <div className="template-downloads"><span>Start with a prepared file:</span><button onClick={downloadExcel} type="button"><Download /> Download Excel template</button><button onClick={downloadCsv} type="button"><Download /> Download CSV template</button></div>}
        <label className="template-file-drop"><input ref={inputRef} accept={mode === "spreadsheet" ? ".xlsx,.csv" : ".pdf,.docx,.txt"} type="file" /><strong>Choose {mode === "spreadsheet" ? "an Excel or CSV file" : "a PDF, DOCX, or TXT file"}</strong><span>Maximum file size: 10 MB</span></label>
        {error && <p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy} onClick={analyze} type="button">{busy ? <LoaderCircle className="spin" /> : mode === "document" ? <FileText /> : <FileSpreadsheet />}{busy ? "Processing…" : mode === "document" ? "Extract templates" : "Review spreadsheet"}</button>
      </div> : <div className="template-import-review">
        <div className="template-import-metrics"><div><strong>{drafts.length}</strong><span>{isScript ? "Rows" : "Templates"} detected</span></div><div><strong>{valid}</strong><span>Ready</span></div><div><strong>{drafts.length - valid}</strong><span>Needs attention</span></div><div><strong>{duplicates}</strong><span>Potential duplicates</span></div></div>
        {missingCategories.length > 0 && <div className="notice"><strong>New categories found</strong><p>Create each category or map it to an existing one.</p><label><input checked={createMissingCategories} onChange={(event) => setCreateMissingCategories(event.target.checked)} type="checkbox" /> Create unmapped categories during import</label>{missingCategories.map((name) => <label key={name}>{name}<select aria-label={`Map ${name}`} onChange={(event) => setCategoryMappings((current) => ({ ...current, [name]: event.target.value }))} value={categoryMappings[name] || ""}><option value="">Create as new</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>)}</div>}
        <div className={source ? "template-review-split" : ""}>{source && <aside><h3>Extracted source text</h3><pre>{source}</pre></aside>}<div className="template-draft-list">
          <div className="template-review-toolbar"><div><button type="button" onClick={() => setDrafts((items) => items.map((item) => ({ ...item, selected: true })))}>Select all</button><button type="button" onClick={() => setDrafts((items) => items.map((item) => ({ ...item, selected: false })))}>Deselect all</button></div>{duplicates > 0 && <label>Duplicates<select value={strategy} onChange={(event) => setStrategy(event.target.value as typeof strategy)}><option value="skip">Skip existing</option><option value="replace">Replace existing</option><option value="new">Import as new</option></select></label>}</div>
          {drafts.map((item, index) => <article className="template-draft-card" key={item.clientId}><div className="template-draft-head"><label><input checked={item.selected} disabled={item.validationIssues.length > 0} onChange={(event) => update(index, { selected: event.target.checked })} type="checkbox" /> Include</label>{item.duplicateReason && <span className="badge amber">{item.duplicateReason}</span>}<button aria-label={`Remove ${item.title || itemName}`} onClick={() => setDrafts((items) => items.filter((_, itemIndex) => itemIndex !== index))} type="button"><Trash2 /></button></div>{item.validationIssues.length > 0 && <p className="form-error">{item.validationIssues.join(" · ")}</p>}<label>{isScript ? "Script name" : isObjection ? "Response name" : "Title"}<input value={item.title} onChange={(event) => update(index, { title: event.target.value, validationIssues: item.validationIssues.filter((issue) => issue !== "Script name is required") })} /></label>{isObjection && <label>Customer objection<textarea rows={3} value={item.objection} onChange={(event) => update(index, { objection: event.target.value, validationIssues: item.validationIssues.filter((issue) => issue !== "Customer objection is required") })} /></label>}<label>{isObjection ? "Approved response" : "Content"}<textarea rows={4} value={item.content} onChange={(event) => update(index, { content: event.target.value, validationIssues: item.validationIssues.filter((issue) => issue !== "Content is required") })} /></label><div className="template-draft-fields"><label>Category<input value={item.category} onChange={(event) => update(index, { category: event.target.value, validationIssues: item.validationIssues.filter((issue) => issue !== "Category is required") })} /></label><label>Status<select value={item.status} onChange={(event) => update(index, { status: event.target.value as Draft["status"], validationIssues: item.validationIssues.filter((issue) => !issue.startsWith("Status must")) })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label>Tags<input value={item.tags.join(", ")} onChange={(event) => update(index, { tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} /></label></div></article>)}
        </div></div>
        {unresolvedCategories && <p className="form-error" role="alert">Map every new category or enable category creation before importing.</p>}{error && <p className="form-error" role="alert">{error}</p>}{summary && <p className="form-success" role="status">{summary}</p>}<footer><button className="btn btn-secondary" onClick={() => reset(mode)} type="button">Choose another file</button><button className="btn btn-primary" disabled={busy || unresolvedCategories || !drafts.some((item) => item.selected)} onClick={importSelected} type="button">{busy ? <LoaderCircle className="spin" /> : <Import />}{busy ? "Importing…" : `Import selected ${noun}`}</button></footer>
      </div>}
    </section></div>}
  </>;
}
