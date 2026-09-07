"use client";

import Link from "next/link";
import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowDown, ArrowUp, Copy, FolderInput, MoreVertical, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { manageProcedureLibrary } from "@/app/operations/procedure-library-actions";
import { categoryProcedures, type LibraryCategory, type LibraryCommand, type LibraryProcedure, type LibraryScope, type LibrarySnapshot } from "@/lib/procedures/library";
import { procedureCategoryStyle } from "./procedure-library-visuals";
import { ProcedureOverlay } from "./procedure-overlay";
import styles from "./procedure-library-management.module.css";

type DialogState = { action: LibraryCommand["action"]; category?: LibraryCategory; procedure?: LibraryProcedure };
type ManagementContext = { snapshot: LibrarySnapshot; canManage: boolean; pending: boolean; open: (dialog: DialogState) => void };
const Management = createContext<ManagementContext | null>(null);

function ActionMenu({ name, children }: { name: string; children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);
  return <details ref={details} className={styles.menu} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); details.current?.removeAttribute("open"); details.current?.querySelector("summary")?.focus(); }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) details.current?.removeAttribute("open"); }}>
    <summary role="button" aria-label={name}><MoreVertical size={18}/></summary>
    <div className={styles.menuItems} onClick={() => details.current?.removeAttribute("open")}>{children}</div>
  </details>;
}

export function CategoryManagementMenu({ id }: { id: string }) {
  const ctx = useContext(Management);
  const category = ctx?.snapshot.categories.find(item => item.id === id);
  if (!ctx?.canManage || !category) return null;
  return <ActionMenu name={`Manage ${category.name}`}>
    <button disabled={ctx.pending} onClick={() => ctx.open({ action: "category_update", category })}><Pencil size={16}/> Rename category</button>
    <button disabled={ctx.pending} onClick={() => ctx.open({ action: "category_reorder", category })}><ArrowUp size={16}/> Reorder category</button>
    <button disabled={ctx.pending} onClick={() => ctx.open({ action: "category_archive", category })}><Archive size={16}/> Archive category</button>
    <button disabled={ctx.pending} className={styles.danger} onClick={() => ctx.open({ action: "category_delete", category })}><Trash2 size={16}/> Delete category</button>
  </ActionMenu>;
}

export function ProcedureManagementMenu({ id, onEdit, editHref }: { id: string; onEdit?: () => void; editHref?: string }) {
  const ctx = useContext(Management);
  const procedure = ctx?.snapshot.procedures.find(item => item.id === id);
  if (!ctx?.canManage || !procedure) return null;
  return <ActionMenu name={`Manage ${procedure.title}`}>
    {onEdit && <button disabled={ctx.pending} onClick={onEdit}><Pencil size={16}/> Edit procedure</button>}
    {editHref && <Link href={editHref}><Pencil size={16}/> Edit procedure</Link>}
    <button disabled={ctx.pending} onClick={() => ctx.open({ action: "procedure_move", procedure })}><FolderInput size={16}/> Move to category</button>
    <button disabled={ctx.pending} onClick={() => ctx.open({ action: "procedure_duplicate", procedure })}><Copy size={16}/> Duplicate procedure</button>
    <button disabled={ctx.pending} onClick={() => ctx.open({ action: "procedure_archive", procedure })}><Archive size={16}/> Archive procedure</button>
    <button disabled={ctx.pending} className={styles.danger} onClick={() => ctx.open({ action: "procedure_delete", procedure })}><Trash2 size={16}/> Delete procedure</button>
  </ActionMenu>;
}

const titles: Record<LibraryCommand["action"], string> = {
  category_create: "Add category", category_update: "Manage category", category_reorder: "Reorder category",
  category_archive: "Archive category", category_restore: "Restore category", category_delete: "Delete category",
  procedure_move: "Move procedure", procedure_duplicate: "Duplicate procedure", procedure_archive: "Archive procedure",
  procedure_restore: "Restore procedure", procedure_delete: "Delete procedure",
};

export function ProcedureLibraryManagement({ scope, snapshot, canManage, children, onChanged }: {
  scope: LibraryScope; snapshot: LibrarySnapshot; canManage: boolean; children: ReactNode; onChanged?: (command: LibraryCommand) => void;
}) {
  const router = useRouter();
  const [archived, setArchived] = useState(false);
  const [archiveType, setArchiveType] = useState<"procedures" | "categories">("procedures");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [destination, setDestination] = useState("");
  const [disposition, setDisposition] = useState<LibraryCommand["disposition"]>("move");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const activeCategories = snapshot.categories.filter(item => !item.archived_at);
  const archivedCategories = snapshot.categories.filter(item => item.archived_at);
  const archivedProcedures = snapshot.procedures.filter(item => item.archived_at);
  const category = snapshot.categories.find(item => item.id === dialog?.category?.id) ?? dialog?.category;
  const procedure = dialog?.procedure;
  const affected = category ? categoryProcedures(snapshot, category) : [];
  const categoryIndex = activeCategories.findIndex(item => item.id === category?.id);
  function open(next: DialogState) {
    setError(""); setMessage(""); setDialog(next); setName(next.category?.name ?? "");
    setDescription(next.category?.description || (next.category ? procedureCategoryStyle(next.category.style_name || next.category.name).description : ""));
    setDestination(""); setDisposition("move");
  }
  function execute(extra: Partial<LibraryCommand> = {}) {
    if (!dialog || pending) return;
    const command: LibraryCommand = { action: dialog.action, id: category?.id ?? procedure?.id, name, description, destination, disposition, confirmed: true, ...extra };
    startTransition(async () => {
      setError("");
      try {
        const result = await manageProcedureLibrary(scope, command);
        if (result.error) { setError(result.error); return; }
        if (command.action !== "category_reorder") setDialog(null);
        onChanged?.(command);
        setMessage(command.action === "category_reorder" ? "Category order saved." : `${titles[command.action]} completed.`);
        router.refresh();
      } catch { setError("The change could not be saved. Please try again."); }
    });
  }
  const destructive = dialog?.action.endsWith("_delete");
  const itemName = category?.name ?? procedure?.title ?? "";
  const searchable = (text: string) => text.toLowerCase().includes(search.trim().toLowerCase());
  const displayPerson = (id: string | null) => id ? snapshot.people[id] || "Team member" : "Not recorded";
  const displayDate = (value: string | null) => value ? new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "Not recorded";
  return <Management.Provider value={{ snapshot, canManage: canManage && !snapshot.error, pending, open }}>
    {snapshot.error && (snapshot.pendingMigration ? <p role="status" className={styles.note}>Category management and archives will be available after the database update is activated. Your existing library is still available.</p> : <p role="alert" className="form-error">{snapshot.error}</p>)}
    {canManage && !snapshot.error && <div className={styles.toolbar}>
      <div className={styles.tabs} aria-label="Library view">
        <button className={!archived ? styles.activeTab : ""} aria-pressed={!archived} onClick={() => setArchived(false)}>Active library</button>
        <button className={archived ? styles.activeTab : ""} aria-pressed={archived} onClick={() => setArchived(true)}><Archive size={16}/> Archived <span>{archivedCategories.length + archivedProcedures.length}</span></button>
      </div>
      {!archived && <button className="btn btn-secondary" disabled={pending || !!snapshot.error} onClick={() => open({ action: "category_create" })}><Plus size={16}/> Add category</button>}
    </div>}
    {!dialog && message && <p role="status" className="form-success">{message}</p>}
    <div hidden={archived}>{children}</div>
    {archived && canManage && <section className={styles.archive} aria-label="Archived items">
      <header><div><h2>Archived items</h2><p>Find and restore items from this {scope === "platform" ? "platform template" : "organization’s procedure"} library.</p></div>
        <label className={styles.search}><Search size={17}/><input aria-label="Search archived items" placeholder="Search archived items…" value={search} onChange={event => setSearch(event.target.value)}/></label></header>
      <div className={styles.tabs} aria-label="Archived item type">
        <button aria-pressed={archiveType === "procedures"} className={archiveType === "procedures" ? styles.activeTab : ""} onClick={() => setArchiveType("procedures")}>Procedures ({archivedProcedures.length})</button>
        <button aria-pressed={archiveType === "categories"} className={archiveType === "categories" ? styles.activeTab : ""} onClick={() => setArchiveType("categories")}>Categories ({archivedCategories.length})</button>
      </div>
      {archiveType === "procedures" ? <div className={styles.archiveRows}>
        {archivedProcedures.filter(item => searchable(`${item.title} ${item.original_category ?? item.category}`)).map(item => <article key={item.id} className={styles.archiveRow}>
          <div><strong>{item.title}</strong><p>Procedure · Original category: {item.original_category ?? item.category}</p><small>Archived {displayDate(item.archived_at)} by {displayPerson(item.archived_by)}</small></div>
          <div className="button-row"><button className="btn btn-secondary" disabled={pending} onClick={() => open({ action: "procedure_restore", procedure: item })}><RotateCcw size={15}/> Restore</button>
            <ActionMenu name={`Manage archived ${item.title}`}><button onClick={() => open({ action: "procedure_move", procedure: item })}><FolderInput size={16}/> Move to category</button><button className={styles.danger} onClick={() => open({ action: "procedure_delete", procedure: item })}><Trash2 size={16}/> Permanently delete</button></ActionMenu></div>
        </article>)}
        {!archivedProcedures.some(item => searchable(`${item.title} ${item.original_category ?? item.category}`)) && <p className={styles.empty}>No archived procedures{search ? " match your search" : " yet"}.</p>}
      </div> : <div className={styles.archiveRows}>
        {archivedCategories.filter(item => searchable(`${item.name} ${item.description}`)).map(item => <article key={item.id} className={styles.archiveRow}>
          <div><strong>{item.name}</strong><p>Category · {categoryProcedures(snapshot, item).length} procedures</p><small>Archived {displayDate(item.archived_at)} by {displayPerson(item.archived_by)}</small></div>
          <div className="button-row"><button className="btn btn-secondary" disabled={pending} onClick={() => open({ action: "category_restore", category: item })}><RotateCcw size={15}/> Restore</button><button className="btn btn-ghost" disabled={pending} aria-label={`Permanently delete ${item.name}`} onClick={() => open({ action: "category_delete", category: item })}><Trash2 size={16}/></button></div>
        </article>)}
        {!archivedCategories.some(item => searchable(`${item.name} ${item.description}`)) && <p className={styles.empty}>No archived categories{search ? " match your search" : " yet"}.</p>}
      </div>}
    </section>}
    {dialog && <ProcedureOverlay compact title={titles[dialog.action]} onClose={() => { if (!pending) setDialog(null); }}>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); execute(); }}>
        <fieldset disabled={pending} className={styles.fields}>
          {(dialog.action === "category_create" || dialog.action === "category_update") ? <>
            <label><span className="label">Category name</span><input className="input" required minLength={2} maxLength={scope === "tenant" ? 80 : 120} value={name} onChange={event => setName(event.target.value)}/></label>
            <label><span className="label">Category description</span><textarea className="input" rows={3} maxLength={1000} value={description} onChange={event => setDescription(event.target.value)}/></label>
          </> : <p><strong>{itemName}</strong></p>}
          {dialog.action === "category_reorder" && <>
            <p>Display position {categoryIndex + 1} of {activeCategories.length}</p>
            <div className="button-row"><button type="button" className="btn btn-secondary" disabled={pending || categoryIndex <= 0} onClick={() => execute({ direction: "up" })}><ArrowUp size={16}/> Move up</button><button type="button" className="btn btn-secondary" disabled={pending || categoryIndex < 0 || categoryIndex === activeCategories.length - 1} onClick={() => execute({ direction: "down" })}><ArrowDown size={16}/> Move down</button></div>
            {message && <p role="status" className="form-success">{message}</p>}
          </>}
          {dialog.action === "category_archive" && <p>This hides the category and its {affected.filter(item => !item.archived_at).length} active procedures from the main library. You can restore them in Archived items.</p>}
          {dialog.action === "category_restore" && <p>Restore this category and the procedures archived with it. Procedures archived separately will stay archived.</p>}
          {dialog.action === "procedure_archive" && <p>This hides the procedure from the main library. Its content and formatting will be preserved in Archived items.</p>}
          {dialog.action === "procedure_duplicate" && <p>Create an independent copy with the same fields, formatting, and content in the current category.</p>}
          {dialog.action === "procedure_delete" && <p className={styles.danger}>Permanently delete this procedure? This cannot be undone.</p>}
          {dialog.action === "category_delete" && <>
            <p>This category contains <strong>{affected.length} {affected.length === 1 ? "procedure" : "procedures"}</strong>, including archived items. Choose what should happen to them before deleting the category.</p>
            <fieldset className={styles.choices}><legend>What happens to its procedures?</legend>
              {([["move", "Move procedures to another category"], ["uncategorized", "Move procedures to Uncategorized"], ["archive", "Archive the procedures"], ["delete", "Delete the category AND its procedures"]] as const).map(([value, label]) => <label key={value} className={value === "delete" ? styles.danger : ""}><input type="radio" name="disposition" value={value} checked={disposition === value} onChange={() => setDisposition(value)}/>{label}</label>)}
            </fieldset>
            <p className={styles.note}>{disposition === "archive" ? "Procedures will remain recoverable under Uncategorized, with their original category recorded." : disposition === "delete" ? "Permanent deletion cannot be undone." : "Already archived procedures remain archived when moved."}</p>
          </>}
          {(dialog.action === "procedure_move" || dialog.action === "procedure_restore" || (dialog.action === "category_delete" && disposition === "move")) && <label>
            <span className="label">{dialog.action === "procedure_restore" ? "Restore to category" : "Destination category"}</span>
            <select className="input" value={destination} required={dialog.action !== "procedure_restore"} onChange={event => setDestination(event.target.value)}>
              <option value="">{dialog.action === "procedure_restore" ? "Original category (if available)" : "Select a category…"}</option>
              {activeCategories.filter(item => item.id !== category?.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>}
          {dialog.action === "procedure_move" && procedure?.archived_at && <p>The procedure stays archived until you restore it.</p>}
        </fieldset>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className={styles.formActions}>
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setDialog(null)}>{dialog.action === "category_reorder" ? "Done" : "Cancel"}</button>
          {dialog.action !== "category_reorder" && <button className={destructive ? `btn ${styles.deleteButton}` : "btn btn-primary"} disabled={pending}>{pending ? "Saving…" : dialog.action === "category_update" ? "Save changes" : titles[dialog.action]}</button>}
        </div>
      </form>
    </ProcedureOverlay>}
  </Management.Provider>;
}
