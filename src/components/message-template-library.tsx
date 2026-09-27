"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, FileText, LoaderCircle, Search, Sparkles, X } from "lucide-react";
import { populateTemplateVariables, templateRelevance, type MessageTemplate, type MessageTemplateKind, type TemplateVariables } from "@/lib/content/message-templates";

type ResponseData = { rows: MessageTemplate[]; categories: string[]; total: number; page: number; error?: string };

export function MessageTemplateLibrary({ kind, communicationType, variables, onUse, onPersonalize }: {
  kind: MessageTemplateKind;
  communicationType: string;
  variables: TemplateVariables;
  onUse: (template: MessageTemplate, content: string) => void;
  onPersonalize: (template: MessageTemplate, content: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ResponseData>({ rows: [], categories: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<MessageTemplate | null>(null);

  useEffect(() => { const timer = window.setTimeout(() => { setLoading(true); setSearch(query); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [query]);
  const autoCategory = useMemo(() => {
    if (category || !communicationType) return "";
    const normalized = communicationType.toLowerCase().replace(/[^a-z0-9]/g, "");
    return data.categories.find((item) => {
      const candidate = item.toLowerCase().replace(/[^a-z0-9]/g, "");
      return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
    }) || "";
  }, [category, communicationType, data.categories]);
  const activeCategory = category || autoCategory;
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ kind, page: String(page) });
    if (search) params.set("q", search);
    if (activeCategory) params.set("category", activeCategory);
    fetch(`/api/message-templates?${params}`, { signal: controller.signal })
      .then(async (response) => { const result = await response.json() as ResponseData; if (!response.ok) throw new Error(result.error || "Templates could not be loaded."); return result; })
      .then(setData)
      .catch((cause) => { if (cause instanceof Error && cause.name !== "AbortError") setData({ rows: [], categories: [], total: 0, page: 1, error: cause.message }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, search, activeCategory, page]);

  const recommendations = useMemo(() => data.rows.map((template) => ({ template, score: templateRelevance(template, communicationType) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map((item) => item.template), [data.rows, communicationType]);
  const filled = (template: MessageTemplate) => populateTemplateVariables(template.body, variables);
  const pages = Math.max(1, Math.ceil(data.total / 100));

  return <section className="message-template-library" aria-busy={loading}>
    <header><div><span>Template Library</span><h2>Start with an approved {kind}</h2><p>Browse the templates maintained in Platform Admin for this workspace.</p></div><FileText/></header>
    <div className="message-template-tools"><label><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates..." aria-label="Search templates"/></label><select value={activeCategory} onChange={(event) => { setLoading(true); setCategory(event.target.value); setPage(1); }} aria-label="Filter by category"><option value="">All categories</option>{data.categories.map((item) => <option key={item}>{item}</option>)}</select></div>
    {recommendations.length > 0 && !search && !category && <div className="message-template-recommended"><strong>Recommended for this customer</strong><div>{recommendations.map((template) => <button key={template.id} type="button" onClick={() => setPreview(template)}><Sparkles/><span>{template.title}</span></button>)}</div></div>}
    {loading ? <div className="message-template-state"><LoaderCircle className="spin"/> Loading templates…</div> : data.error ? <p className="form-error" role="alert">{data.error}</p> : data.rows.length ? <div className="message-template-results">{data.rows.map((template) => <article key={template.id}><div><span>{template.category}</span><h3>{template.title}</h3><p>{template.body}</p></div><footer><button type="button" className="btn btn-ghost" onClick={() => setPreview(template)}><Eye/> Preview</button><button type="button" className="btn btn-primary" onClick={() => onUse(template, filled(template))}>Use Template</button></footer></article>)}</div> : <div className="message-template-state"><FileText/><strong>No published {kind} templates found</strong><span>Try another search or ask an administrator to publish one.</span></div>}
    {pages > 1 && <nav className="message-template-pagination" aria-label="Template pages"><button type="button" disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1); }}><ChevronLeft/> Previous</button><span>Page {page} of {pages} · {data.total} templates</span><button type="button" disabled={page >= pages} onClick={() => { setLoading(true); setPage((value) => value + 1); }}>Next <ChevronRight/></button></nav>}
    {preview && <div className="message-template-modal" role="dialog" aria-modal="true" aria-labelledby="template-preview-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}><div><header><div><span>{preview.category} · {kind === "email" ? "Email" : "Text"}</span><h2 id="template-preview-title">{preview.title}</h2></div><button type="button" onClick={() => setPreview(null)} aria-label="Close preview"><X/></button></header><pre>{filled(preview)}</pre><footer><button className="btn btn-ghost" type="button" onClick={() => { onUse(preview, filled(preview)); setPreview(null); }}>Use Template</button><button className="btn btn-primary" type="button" onClick={() => { onPersonalize(preview, filled(preview)); setPreview(null); }}><Sparkles/> Personalize with AI</button></footer></div></div>}
  </section>;
}
