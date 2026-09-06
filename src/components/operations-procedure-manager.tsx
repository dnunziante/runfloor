"use client";

import {
  AlertTriangle,
  BookOpen,
  ArrowLeft,
  FolderOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileEdit,
  Pencil,
  Plus,
  Search,
  Trash2,

} from "lucide-react";
import Link from "next/link";
import { ProcedureCategoryCard, ProcedureValueBanner, procedureCategoryStyle } from "./procedure-library-visuals";
import { ProcedureOverlay } from "./procedure-overlay";
import library from "./platform-procedure-template-library.module.css";
import layout from "./procedure-workspace.module.css";
import { useMemo, useState } from "react";
import {
  deleteOperationsProcedure,
  deleteOperationsProcedureCategory,
  reorderOperationsProcedures,
  saveOperationsProcedure,
  saveOperationsProcedureCategory,
} from "@/app/operations/actions";
import {
  defaultOperationsProcedureCategories,
  type OperationsProcedureCategory,
  type OperationsProcedureRecord,
} from "@/lib/operations/data";
import type { OperationsPersistence } from "@/lib/operations/repository";
import type { JSONContent } from "@tiptap/core";
import { ProcedureRichBody } from "./procedure-rich-body";
import { documentText, procedureDocument } from "@/lib/procedures/document";
import { ProcedureContent } from "@/components/procedure-content";

export function OperationsProcedureManager({
  initialProcedures = [],
  initialCategories = defaultOperationsProcedureCategories,
  persistence = "demo",
  initialError = "",
  canManage = true,
}: {
  initialProcedures?: OperationsProcedureRecord[];
  initialCategories?: OperationsProcedureCategory[];
  persistence?: OperationsPersistence;
  initialError?: string;
  canManage?: boolean;
}) {
  const [procedures, setProcedures] = useState(initialProcedures);
  const [categories, setCategories] = useState(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryEditor, setCategoryEditor] = useState<OperationsProcedureCategory | "new" | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [deleting, setDeleting] = useState<OperationsProcedureCategory | "procedure" | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategories[0]?.id ?? "");
  const [owner, setOwner] = useState("");
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState("");
  const [richDocument, setRichDocument] = useState<JSONContent | null>(null);
  const [status, setStatus] =
    useState<OperationsProcedureRecord["status"]>("Draft");
  const selected = procedures.find((item) => item.id === selectedId) ?? null;
  const [readingId, setReadingId] = useState<string | null>(null);
  const reading = procedures.find((item) => item.id === readingId) ?? null;
  const category = categories.find((item) => item.id === selectedCategory);
  const orderedCategories = [...categories].sort((left, right) => {
    const leftIndex = defaultOperationsProcedureCategories.findIndex(
      (item) => item.name === left.name,
    );
    const rightIndex = defaultOperationsProcedureCategories.findIndex(
      (item) => item.name === right.name,
    );
    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    if (leftIndex >= 0) return -1;
    if (rightIndex >= 0) return 1;
    return left.name.localeCompare(right.name);
  });
  const filtered = useMemo(
    () =>
      procedures.filter(
        (item) =>
          (!selectedCategory || item.categoryId === selectedCategory) &&
          `${item.title} ${item.category} ${item.summary} ${item.owner}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [procedures, selectedCategory, search],
  );
  const clear = () => {
    setSelectedId(null); setReadingId(null); setError("");
    setEditingId(null);
    setTitle("");
    setCategoryId(selectedCategory ?? categories[0]?.id ?? "");
    setOwner("");
    setSummary("");
    setSteps(""); setRichDocument(null);
    setStatus("Draft");
  };
  const edit = (item: OperationsProcedureRecord) => {
    setPanelOpen(true); setReadingId(null); setError("");
    setSelectedId(item.id);
    setEditingId(item.id);
    setTitle(item.title);
    setCategoryId(item.categoryId);
    setOwner(item.owner);
    setSummary(item.summary);
    setSteps(item.steps.join("\n\n"));
    setRichDocument(item.content?.runfloorDocument ? procedureDocument({ steps: item.steps, content: item.content }) : null);
    setStatus(item.status);
  };
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const category = categories.find((item) => item.id === categoryId);
    const stepList = richDocument ? [documentText(richDocument)] : steps
      .split(/\r?\n\s*\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (
      !category ||
      title.trim().length < 2 ||
      owner.trim().length < 2 ||
      summary.trim().length < 10 ||
      !stepList.length
    )
      return setError(
        "Add a title, category, owner, useful summary, and at least one step.",
      );
    const old = procedures.find((item) => item.id === editingId);
    let record: OperationsProcedureRecord = {
      ...old,
      id: old?.id ?? `new-${crypto.randomUUID()}`,
      title: title.trim(),
      categoryId: category.id,
      category: category.name,
      owner: owner.trim(),
      summary: summary.trim(),
      steps: stepList,
      ...(richDocument ? { content: { ...old?.content, runfloorDocument: { format: "tiptap-v1", document: richDocument } }, sourceType: old?.sourceType } : {}),
      status,
      version: old ? old.version + 1 : 1,
      updatedAt: new Date().toISOString(),
    };
    if (persistence === "supabase") {
      const result = await saveOperationsProcedure(record);
      if (result.error || !result.record)
        return setError(result.error ?? "Procedure could not be saved.");
      record = result.record;
    }
    setProcedures((items) => [
      record,
      ...items.filter((item) => item.id !== record.id),
    ]);
    setSelectedId(record.id);
    setEditingId(record.id);
    setError("");
    setMessage("Procedure saved.");
    setPanelOpen(false); setReadingId(record.id);
  }
  async function removeProcedure() {
    if (!selected) return;
    if (persistence === "supabase") {
      const result = await deleteOperationsProcedure(selected.id);
      if (result.error) return setError(result.error);
    }
    setProcedures((items) => items.filter((item) => item.id !== selected.id));
    setSelectedId(null);
    clear(); setPanelOpen(false);
    setMessage("Procedure deleted.");
  }
  async function moveProcedure(id: string, direction: -1 | 1) {
    if (!selectedCategory) return;
    const ids = filtered.map((item) => item.id); const index = ids.indexOf(id); const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    if (persistence === "supabase") { const result = await reorderOperationsProcedures(selectedCategory, ids); if (result.error) return setError(result.error); }
    const order = new Map(ids.map((item, position) => [item, position])); setProcedures((items) => [...items].sort((left, right) => left.categoryId === selectedCategory && right.categoryId === selectedCategory ? (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0) : 0)); setMessage("Procedure order saved.");
  }
  async function changeCategory(item?: OperationsProcedureCategory) {
    const name = categoryName;
    if (!name?.trim()) return;
    if (persistence === "supabase") {
      const result = await saveOperationsProcedureCategory({
        id: item?.id,
        name,
      });
      if (result.error || !result.record)
        return setError(result.error ?? "Category could not be saved.");
      setCategories((items) =>
        item
          ? items.map((entry) =>
              entry.id === item.id ? result.record! : entry,
            )
          : [...items, result.record!],
      );
    } else {
      const result = item
        ? { ...item, name: name.trim() }
        : {
            id: `category-${crypto.randomUUID()}`,
            name: name.trim(),
            isDefault: false,
          };
      if (
        categories.some(
          (entry) =>
            entry.id !== item?.id &&
            entry.name.toLowerCase() === result.name.toLowerCase(),
        )
      )
        return setError("This category already exists.");
      setCategories((items) =>
        item
          ? items.map((entry) => (entry.id === item.id ? result : entry))
          : [...items, result],
      );
      setProcedures((items) =>
        item
          ? items.map((entry) =>
              entry.categoryId === item.id
                ? { ...entry, category: result.name }
                : entry,
            )
          : items,
      );
    }
    if (item) setProcedures(entries => entries.map(entry => entry.categoryId === item.id ? { ...entry, category: name.trim() } : entry));
    setCategoryEditor(null); setError("");
    setMessage(item ? "Category renamed." : "Category created.");
  }
  async function removeCategory(item: OperationsProcedureCategory) {
    if (procedures.some((procedure) => procedure.categoryId === item.id))
      return setError(
        "Move the procedures in this category before deleting it.",
      );

    if (persistence === "supabase") {
      const result = await deleteOperationsProcedureCategory(item.id);
      if (result.error) return setError(result.error);
    }
    setCategories((items) => items.filter((entry) => entry.id !== item.id));
    if (selectedCategory === item.id) setSelectedCategory(null);
    setMessage("Category deleted.");
  }
  const editor =
    selected && !editingId ? (
      <>
        <h2>{selected.title}</h2>
        <ProcedureContent content={selected.summary}/>
        <p>
          <strong>Category:</strong> {selected.category} ·{" "}
          <strong>Owner:</strong> {selected.owner}
        </p>
        {selected.content?.runfloorDocument ? <ProcedureRichBody key={`read-${selected.id}-${selected.version}`} document={procedureDocument({ steps: selected.steps, content: selected.content })} /> : <ol>
          {selected.steps.map((step, index) => (
          <li key={index}><ProcedureContent content={step}/></li>
          ))}
        </ol>}
        {canManage && (
          <div className="button-row">
            <button
              className="btn btn-secondary"
              onClick={() => edit(selected)}
            >
              <FileEdit size={16} /> Edit
            </button>
            <button className="btn btn-danger" onClick={() => setDeleting("procedure")}>
              <Trash2 size={16} /> Delete
            </button>
          </div>
        )}
      </>
    ) : canManage ? (
      <form className="form-stack" onSubmit={async event => { if (saving) { event.preventDefault(); return; } setSaving(true); try { await save(event); } catch { setError("Could not save the procedure. Your edits are still here."); } finally { setSaving(false); } }}>
        <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 22 }}>
        <label>
          <span className="label">Procedure title</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <div className="grid grid-2">
          <label>
            <span className="label">Category</span>
            <select
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {orderedCategories.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Owner</span>
            <input
              className="input"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              required
            />
          </label>
        </div>
        <label>
          <span className="label">Purpose and scope</span>
          <textarea
            className="input"
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
          />
        </label>
        {richDocument ? <ProcedureRichBody key={`edit-${editingId}`} document={richDocument} editable onChange={setRichDocument} /> : (
        <label>
          <span className="label">Procedure steps</span>
          <textarea
            className="input"
            rows={7}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            required
          />
          <small className="field-help">Separate steps with a blank line. Existing formatting is preserved.</small>
        </label>)}
        <label>
          <span className="label">Publishing status</span>
          <select
            className="input"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as OperationsProcedureRecord["status"])
            }
          >
            <option>Draft</option>
            <option>Published</option>
          </select>
        </label>
        <div className={layout.formActions}><button type="button" className="btn btn-secondary" onClick={() => setPanelOpen(false)}>Cancel</button>
        <button className="btn btn-primary" disabled={saving}>
          <CheckCircle2 size={16} />{" "}
          {saving ? "Saving…" : editingId ? "Save next version" : "Create procedure"}
        </button>{editingId && <button type="button" className="btn btn-danger" onClick={() => setDeleting("procedure")}>Delete procedure</button>}</div></fieldset>
      </form>
    ) : (
      <>
        <Eye size={24} />
        <h2>Select a procedure</h2>
      </>
    );
  function openProcedure(item: OperationsProcedureRecord) { setSelectedId(item.id); setReadingId(item.id); setEditingId(null); }
  function newProcedure() { clear(); setPanelOpen(true); }
  return <section className={`${library.library} ${layout.workspace}`} aria-label="Organization procedure library">
    <header className={library.header}><div className={library.heading}><span className={library.book}><BookOpen size={27} /></span><div><h1>Procedure Templates</h1><p>Standardize operations. Train faster. Deliver a better experience.</p></div></div><div className={library.tools}><label className={library.search}><Search size={18} /><input aria-label="Search procedures" placeholder="Search procedures…" value={search} onChange={event => { setSearch(event.target.value); setSelectedCategory(null); }} /></label>{canManage && <button className="btn btn-primary" onClick={newProcedure}><Plus size={17} /> New Procedure</button>}</div></header>
    <ProcedureValueBanner />
    <div className={layout.secondary}><Link className="btn btn-ghost" href="/operations"><ArrowLeft size={15} /> Operations dashboard</Link>{canManage && <div className="button-row"><button className="btn btn-ghost" onClick={() => { setCategoryName(""); setCategoryEditor("new"); setError(""); }}><Plus size={16} /> Add Category</button><button className="btn btn-ghost" aria-pressed={managingCategories} onClick={() => setManagingCategories(!managingCategories)}>{managingCategories ? "Done managing" : "Manage Categories"}</button></div>}</div>
    {persistence === "demo" && <p className="callout">Demo procedures are separate from organization records.</p>}
    {!panelOpen && error && <p role="alert" className="form-error"><AlertTriangle size={14} /> {error}</p>}
    {message && <p role="status" className="form-success">{message}</p>}
    {!selectedCategory && !search.trim() && <div className={library.categories} aria-label="Procedure categories">{orderedCategories.map(item => <div className={layout.categoryGroup} key={item.id}><ProcedureCategoryCard name={item.name} count={procedures.filter(procedure => procedure.categoryId === item.id).length} noun="procedures" selected={false} onClick={() => { setSelectedCategory(item.id); setSelectedId(null); }} />{canManage && managingCategories && <div className={layout.categoryActions}>{item.isDefault ? <small>Default category</small> : <><button className="btn btn-ghost" aria-label={`Rename ${item.name}`} onClick={() => { setCategoryName(item.name); setCategoryEditor(item); setError(""); }}><Pencil size={14}/> Rename</button><button className="btn btn-ghost" aria-label={`Delete ${item.name}`} onClick={() => setDeleting(item)}><Trash2 size={14}/> Delete</button></>}</div>}</div>)}</div>}
    {(selectedCategory || search.trim()) && <div className={library.results}><div className={library.panelHeading}><div><button className="btn btn-ghost" onClick={() => { setSelectedCategory(null); setSearch(""); }}><ArrowLeft size={16}/> All categories</button><h2>{category?.name ?? "Search results"}</h2><p>{category ? procedureCategoryStyle(category.name).description : `Matching “${search}” across your organization's procedures`}</p><p role="status">{filtered.length} {filtered.length === 1 ? "procedure" : "procedures"}</p></div>{canManage && <button className="btn btn-secondary" onClick={newProcedure}><Plus size={16}/> New Procedure</button>}</div>
      {filtered.length ? <div className={library.templates}>{filtered.map((item,index) => <article className={library.template} key={item.id}><div className={library.metadata}><span>{item.category}</span><span>{item.status} · v{item.version}</span></div><button className={layout.cardOpen} onClick={() => openProcedure(item)}><strong>{item.title}</strong><p>{item.summary}</p></button><div className={library.metadata}>{item.owner}</div><div className={layout.cardActions}><button className="btn btn-secondary" onClick={() => openProcedure(item)}><Eye size={16}/> Open procedure</button>{canManage && <><button className="btn btn-ghost" aria-label={`Edit ${item.title}`} onClick={() => edit(item)}><FileEdit size={16}/></button>{selectedCategory && !search && <><button className="icon-button" aria-label={`Move ${item.title} up`} disabled={index === 0} onClick={() => moveProcedure(item.id,-1)}><ChevronUp size={16}/></button><button className="icon-button" aria-label={`Move ${item.title} down`} disabled={index === filtered.length-1} onClick={() => moveProcedure(item.id,1)}><ChevronDown size={16}/></button></>}</>}</div></article>)}</div> : <div className={library.empty}><FolderOpen size={30}/><h3>{search ? "No matching procedures" : "Ready for your first procedure"}</h3><p>{search ? "Try another title, category, owner, or keyword." : `Build your team's playbook with a ${category?.name} procedure.`}</p>{canManage && <button className="btn btn-primary" onClick={newProcedure}><Plus size={16}/> New Procedure</button>}</div>}
    </div>}
    {panelOpen && canManage && <ProcedureOverlay title={editingId ? "Edit procedure" : "Create procedure"} drawer onClose={() => { if (!saving) setPanelOpen(false); }}><div>{error && <p role="alert" className="form-error">{error}</p>}{editor}</div></ProcedureOverlay>}
    {reading && !panelOpen && <ProcedureOverlay title={reading.title} onClose={() => setReadingId(null)}><div className={layout.reader}>{error && <p role="alert" className="form-error">{error}</p>}<div className={layout.readerMeta}><span>{reading.category}</span><span>Owner: {reading.owner}</span><span>{reading.status} · Version {reading.version}</span></div>{canManage && <div className="button-row"><button className="btn btn-primary" onClick={() => edit(reading)}><FileEdit size={16}/> Edit procedure</button><button className="btn btn-ghost" onClick={() => setDeleting("procedure")}><Trash2 size={16}/> Delete procedure</button></div>}<h3>Purpose and scope</h3><ProcedureContent content={reading.summary}/><h3>Procedure</h3>{reading.content?.runfloorDocument ? <ProcedureRichBody key={`full-${reading.id}-${reading.version}`} document={procedureDocument({steps:reading.steps,content:reading.content})}/> : reading.steps.length ? reading.steps.map((step,index) => <div className="procedure-reading-step" key={index}><strong>{index+1}</strong><ProcedureContent content={step}/></div>) : <p>No procedure steps have been added yet.</p>}</div></ProcedureOverlay>}
    {categoryEditor && <ProcedureOverlay title={categoryEditor === "new" ? "Add category" : "Rename category"} onClose={() => setCategoryEditor(null)}><form className="form-stack" onSubmit={async event => { event.preventDefault(); setSaving(true); try { await changeCategory(categoryEditor === "new" ? undefined : categoryEditor); } catch { setError("Could not save the category. Please try again."); } finally { setSaving(false); } }}><label><span className="label">Category name</span><input className="input" value={categoryName} onChange={event => setCategoryName(event.target.value)} minLength={2} maxLength={80} required disabled={saving}/></label>{error && <p role="alert" className="form-error">{error}</p>}<div className={layout.formActions}><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setCategoryEditor(null)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save category"}</button></div></form></ProcedureOverlay>}
    {deleting && <ProcedureOverlay title="Confirm deletion" onClose={() => setDeleting(null)}><p>Delete “{deleting === "procedure" ? selected?.title : deleting.name}”?</p><div className={layout.formActions}><button className="btn btn-secondary" disabled={saving} onClick={() => setDeleting(null)}>Cancel</button><button className="btn btn-danger" disabled={saving} onClick={async () => { setSaving(true); try { if (deleting === "procedure") await removeProcedure(); else await removeCategory(deleting); } catch { setError("Could not delete this item. Please try again."); } finally { setSaving(false); setDeleting(null); } }}>Delete</button></div></ProcedureOverlay>}
  </section>;
}
