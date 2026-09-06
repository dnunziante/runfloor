"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, FilePlus2, FolderOpen, Plus, Search, X } from "lucide-react";
import { procedureCategoryStyles as categories, ProcedureCategoryCard, ProcedureValueBanner } from "./procedure-library-visuals";
import { copyPlatformProcedureTemplate } from "@/app/admin/platform/actions";
import styles from "./platform-procedure-template-library.module.css";

type Template = { id: string; title: string; category: string; owner: string; summary: string; version: number };

export function PlatformProcedureTemplateLibrary({ templates, tenants, children, initialCategory = null, initialQuery = "" }: { templates: Template[]; tenants: Array<{ id: string; name: string }>; children: ReactNode; initialCategory?: string | null; initialQuery?: string }) {
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const creator = useRef<HTMLDivElement>(null);
  const manager = useRef<HTMLElement>(null);
  const search = query.trim().toLowerCase();
  const visible = templates.filter(template => search
    ? [template.title, template.summary, template.category, template.owner].some(value => value?.toLowerCase().includes(search))
    : template.category === category);
  const selected = visible.find(template => template.id === selectedId);
  const availableCategories = [...categories, ...Array.from(new Set(templates.map(template => template.category))).filter(name => !categories.some(category => category.name === name)).map(name => ({ name, description: "Explore your existing procedure templates.", icon: FolderOpen, color: "#64748b", tint: "#f3f5f8" }))];
  const orderedTenants = [...tenants].sort((a, b) => a.name.localeCompare(b.name));

  function clearSelection() {
    setSelectedId(null); setSelectedTenants([]); setMessage(""); setError("");
  }
  function addTemplate() {
    setCreating(true);
    requestAnimationFrame(() => {
      const field = creator.current?.querySelector<HTMLSelectElement>('select[name="category"]');
      if (field) field.value = category || "Uncategorized";
      creator.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      creator.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus({ preventScroll: true });
    });
  }
  function openTemplate(id: string) {
    clearSelection(); setSelectedId(id);
    requestAnimationFrame(() => { manager.current?.focus({ preventScroll: true }); manager.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); });
  }
  async function apply() {
    if (!selected || !selectedTenants.length || saving) return;
    setSaving(true); setMessage(""); setError("");
    try {
      let added = 0; let alreadyThere = 0;
      for (const organizationId of selectedTenants) {
        const form = new FormData(); form.set("templateId", selected.id); form.set("organizationId", organizationId);
        const result = await copyPlatformProcedureTemplate(form);
        if (result.copied) added += 1; else alreadyThere += 1;
      }
      const parts = [];
      if (added) parts.push(`Added “${selected.title}” to ${added} tenant${added === 1 ? "" : "s"}.`);
      if (alreadyThere) parts.push(`${alreadyThere} tenant${alreadyThere === 1 ? " already has" : "s already have"} this procedure.`);
      setMessage(parts.join(" ") || "No tenant changes were needed."); setSelectedTenants([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The template could not be added. Please try again."); }
    finally { setSaving(false); }
  }

  return <section className={styles.library} aria-labelledby="procedure-library-heading">
    <header className={styles.header}>
      <div className={styles.heading}><span className={styles.book}><BookOpen size={27} aria-hidden="true" /></span><div><span className={styles.eyebrow}>RUNFLOOR PLAYBOOK</span><h2 id="procedure-library-heading">Procedure Templates</h2><p>Standardize operations. Train faster. Deliver a better experience.</p></div></div>
      <div className={styles.tools}><label className={styles.search}><Search size={18} aria-hidden="true" /><input aria-label="Search templates" placeholder="Search templates…" value={query} disabled={saving} onChange={event => { setQuery(event.target.value); setCategory(null); clearSelection(); }} />{query && <button type="button" aria-label="Clear template search" disabled={saving} onClick={() => { setQuery(""); clearSelection(); }}><X size={16} /></button>}</label><button type="button" className="btn btn-primary" onClick={addTemplate}><Plus size={17} /> Add Template</button></div>
    </header>
    <ProcedureValueBanner templates />
    <div ref={creator} hidden={!creating} className={styles.creator} id="platform-template-create"><div className={styles.panelHeading}><h3>Create a procedure template</h3><button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}><X size={16} /> Close</button></div>{children}</div>
    <div className={styles.categories} aria-label="Procedure template categories">
      {availableCategories.map(({ name }) => <ProcedureCategoryCard key={name} name={name} count={templates.filter(template => template.category === name).length} selected={category === name} disabled={saving} onClick={() => { setCategory(category === name ? null : name); setQuery(""); clearSelection(); }} />)}
    </div>
    <div id="procedure-template-results" hidden={!category && !search} className={styles.results}>
      <div className={styles.panelHeading}><div><h3>{search ? "Search results" : category}</h3><p role="status">{visible.length} {visible.length === 1 ? "template" : "templates"}{search ? ` matching “${query.trim()}”` : " in this category"}</p></div><button type="button" className="btn btn-secondary" onClick={addTemplate}><Plus size={16} /> Add Template</button></div>
      {visible.length ? <div className={styles.templates}>{visible.map(template => <div key={template.id} className={styles.template}><span className={styles.metadata}>{template.category} <span>v{template.version}</span></span><strong>{template.title}</strong>{template.summary && <p>{template.summary}</p>}<span className={styles.templateFooter}><span>{template.owner || "Procedure template"}</span><Link href={`/admin/platform/procedures/${template.id}?${new URLSearchParams({ category: category || "", templateSearch: query })}`}>Open Procedure <ArrowRight size={14} /></Link></span><button type="button" className="btn btn-ghost" disabled={saving} onClick={() => openTemplate(template.id)}>Assign to tenants</button></div>)}</div> : <div className={styles.empty}><FolderOpen size={30} aria-hidden="true" /><h4>{search ? "No matching templates" : "No templates here yet."}</h4><p>{search ? "Try a different name, category, owner, or keyword." : `Create your first ${category} procedure.`}</p><button type="button" className="btn btn-primary" onClick={addTemplate}><Plus size={16} /> Add Template</button></div>}
      {selected && <section ref={manager} tabIndex={-1} className={styles.manager} aria-label={`Manage ${selected.title}`}><div className={styles.panelHeading}><div><span className={styles.eyebrow}>TEMPLATE DETAILS</span><h3>{selected.title}</h3></div><button type="button" className="btn btn-ghost" disabled={saving} onClick={clearSelection}>Close details</button></div><p>{selected.summary}</p><p className={styles.metadata}>{selected.category} · {selected.owner} · v{selected.version}</p><fieldset disabled={saving} className={styles.tenants}><legend>Add to tenant workspaces</legend><label><input type="checkbox" checked={orderedTenants.length > 0 && selectedTenants.length === orderedTenants.length} disabled={!orderedTenants.length} onChange={event => setSelectedTenants(event.target.checked ? orderedTenants.map(tenant => tenant.id) : [])} /> Add to all active tenants</label>{orderedTenants.map(tenant => <label key={tenant.id}><input type="checkbox" checked={selectedTenants.includes(tenant.id)} onChange={event => setSelectedTenants(ids => event.target.checked ? [...ids, tenant.id] : ids.filter(id => id !== tenant.id))} /> {tenant.name}</label>)}{!orderedTenants.length && <p>No active tenants available.</p>}</fieldset><button type="button" className="btn btn-primary" disabled={!selectedTenants.length || saving} onClick={apply}>{saving ? "Adding…" : "Add to selected tenants"}</button>{message && <p role="status" className="form-success">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}</section>}
    </div>
    <footer className={styles.cta}><FilePlus2 size={28} aria-hidden="true" /><div><h3>Don’t see what you need?</h3><p>Create a new procedure template and keep building your playbook.</p></div><button type="button" className="btn btn-primary" onClick={addTemplate}><Plus size={17} /> Add New Template</button></footer>
  </section>;
}
