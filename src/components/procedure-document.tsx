"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { ArrowLeft, Copy, Pencil, Save } from "lucide-react";
import { duplicateProcedureTemplate, updateProcedureTemplate } from "@/app/admin/platform/procedures/actions";
import { documentText, procedureDocument, type ProcedureTemplate } from "@/lib/procedures/document";
import { procedureExtensions } from "@/lib/procedures/extensions";
import { ProcedureFormattingToolbar } from "./procedure-formatting-toolbar";
import styles from "./procedure-document.module.css";

export function ProcedureDocument({ initial, backHref }: { initial: ProcedureTemplate; backHref: string }) {
  const router = useRouter();
  const toc = useRef<HTMLDetailsElement>(null);
  const [record, setRecord] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState(initial.category);
  const [owner, setOwner] = useState(initial.owner);
  const [summary, setSummary] = useState(initial.summary);
  const [bodyChanged, setBodyChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const editor = useEditor({ extensions: procedureExtensions(), content: procedureDocument(initial), editable: false, immediatelyRender: false, editorProps: { attributes: { "aria-label": "Complete procedure body", class: styles.prose } }, onUpdate: () => setBodyChanged(true) });
  const dirty = editing && (bodyChanged || title !== record.title || category !== record.category || owner !== record.owner || summary !== record.summary);
  useEffect(() => { editor?.setEditable(editing && !busy); }, [editor, editing, busy]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.("a[href]");
      if (anchor && !anchor.getAttribute("href")?.startsWith("#") && !window.confirm("Discard unsaved procedure changes?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
  const headings: string[] = [];
  function collect(node: JSONContent) { if (node.type === "heading") headings.push(documentText(node)); node.content?.forEach(collect); }
  collect(procedureDocument(record));
  useEffect(() => {
    const screen = window.matchMedia("(max-width: 1050px)");
    const sync = () => { if (toc.current) toc.current.open = !screen.matches; };
    sync(); screen.addEventListener("change", sync);
    return () => screen.removeEventListener("change", sync);
  }, [editing, headings.length]);
  const extra = Object.fromEntries(Object.entries(record.content || {}).filter(([key]) => key !== "runfloorDocument"));
  const hasBody = documentText(procedureDocument(record)).trim().length > 0;
  function cancel() {
    editor?.commands.setContent(procedureDocument(record), { emitUpdate: false });
    setTitle(record.title); setCategory(record.category); setOwner(record.owner); setSummary(record.summary);
    setBodyChanged(false); setEditing(false); setError("");
  }
  async function save() {
    if (!editor || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await updateProcedureTemplate({ id: record.id, updatedAt: record.updated_at, title, category, owner, summary, ...(bodyChanged ? { document: JSON.parse(JSON.stringify(editor.getJSON())) as JSONContent } : {}) });
      if (!result.template) { setError(result.error || "Could not save the procedure."); return; }
      setRecord(result.template); setEditing(false); setBodyChanged(false); setMessage("Changes saved."); router.refresh();
    } catch { setError("Could not reach the workspace. Your edits are still here; please try again."); }
    finally { setBusy(false); }
  }
  async function duplicate() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await duplicateProcedureTemplate(record.id);
      if (!result.template) { setError(result.error || "Could not duplicate the procedure."); return; }
      const context = backHref.split("?")[1]?.split("#")[0];
      router.push(`/admin/platform/procedures/${result.template.id}${context ? `?${context}` : ""}`);
    } catch { setError("Could not reach the workspace. Please check the template library before retrying duplication."); }
    finally { setBusy(false); }
  }
  return <div className={styles.workspace}>
    <Link className={styles.back} href={backHref}><ArrowLeft size={16} /> Back to Templates</Link>
    <header className={styles.header}><div><span className={styles.eyebrow}>RUNFLOOR OPERATING PLAYBOOK</span><h1>{record.title}</h1><p>{record.category} <span>· Version {record.version}</span> <span>· {record.owner || "Team not assigned"}</span></p></div><div className={styles.actions}>{editing ? <><button className="btn btn-primary" disabled={busy || !dirty} onClick={save}><Save size={16} /> {busy ? "Saving…" : "Save Changes"}</button><button className="btn btn-secondary" disabled={busy} onClick={cancel}>Cancel</button></> : <><button className="btn btn-primary" disabled={!editor || busy} onClick={() => { setEditing(true); setMessage(""); }}><Pencil size={16} /> Edit Procedure</button><button className="btn btn-secondary" disabled={busy} onClick={duplicate}><Copy size={16} /> {busy ? "Duplicating…" : "Duplicate"}</button></>}</div></header>
    {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status" className="form-success">{message}</p>}
    <div className={`${styles.layout} ${!editing && headings.length >= 4 ? styles.withToc : ""}`}>
      {!editing && headings.length >= 4 && <aside className={styles.toc}><details ref={toc} open><summary>On this page</summary><nav aria-label="Procedure sections"><a href="#procedure-overview">Overview & purpose</a>{headings.map((heading, index) => <button key={index} onClick={() => editor?.view.dom.querySelectorAll("h1,h2,h3,h4,h5,h6")[index]?.scrollIntoView({ behavior: "smooth", block: "start" })}>{heading}</button>)}</nav></details></aside>}
      <article className={styles.document} id="procedure-overview">
        {editing ? <div className={styles.fields}><label>Procedure title<input className="input" value={title} maxLength={160} onChange={event => setTitle(event.target.value)} disabled={busy} /></label><div><label>Category<input className="input" value={category} maxLength={120} onChange={event => setCategory(event.target.value)} disabled={busy} /></label><label>Team / Department<input className="input" value={owner} maxLength={120} onChange={event => setOwner(event.target.value)} disabled={busy} /></label></div><label>Description / Purpose<textarea className="input" rows={5} value={summary} onChange={event => setSummary(event.target.value)} disabled={busy} /></label><p>Version {record.version} · Saving creates version {record.version + 1}.</p></div> : <div className={styles.overview}><span className={styles.eyebrow}>STANDARD OPERATING PROCEDURE</span><h2>{record.title}</h2><div className={styles.meta}><span>{record.category}</span><span>{record.owner || "Team not assigned"}</span><span>Version {record.version}</span></div><h3>Purpose</h3><p>{record.summary || "No purpose has been added yet."}</p></div>}
        {editing && editor && <ProcedureFormattingToolbar editor={editor} busy={busy} setError={setError} />}
        {!editing && !hasBody && <div className={styles.empty}>No procedure content has been added yet.</div>}
        <div className={styles.body} data-testid="full-procedure-body"><EditorContent editor={editor} />{!editor && <p>Loading complete procedure…</p>}</div>
        {Object.keys(extra).length > 0 && <section className={styles.additional}><h3>Additional stored information</h3><pre>{JSON.stringify(extra, null, 2)}</pre></section>}
        <footer className={styles.footer}>Version {record.version} · Updated {new Date(record.updated_at).toLocaleDateString("en-US", { timeZone: "UTC" })} (UTC) · Platform procedure template</footer>
      </article>
    </div>
  </div>;
}
