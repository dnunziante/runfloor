"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenCheck, FileText, LoaderCircle, Pencil, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { deleteKnowledgeDocument, reindexKnowledgeDocument, updateKnowledgeDocumentCollection } from "@/app/knowledge-base/actions";
import { KNOWLEDGE_COLLECTIONS } from "@/lib/knowledge/collections";
import type { KnowledgeDocumentDTO } from "@/lib/knowledge/types";

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function KnowledgeManager({ documents, canManage, locations = [], products = [], isRv = false }: { documents: KnowledgeDocumentDTO[]; canManage: boolean; locations?: { id: string; name: string }[]; products?: { id: string; name: string }[]; isRv?: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("All Collections");
  const [uploading, setUploading] = useState(false);
  const [createTraining, setCreateTraining] = useState(true);
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [isBuildingModule, setIsBuildingModule] = useState(false);
  const [isCollectionPending, startCollectionTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const shown = useMemo(() => documents.filter((document) => `${document.title} ${document.filename} ${document.collection}`.toLowerCase().includes(query.toLowerCase()) && (collectionFilter === "All Collections" || document.collection === collectionFilter)), [documents, query, collectionFilter]);
  const selectedDocuments = documents.filter((document) => selectedDocumentIds.has(document.id) && document.status === "Ready");
  const selectableShownDocuments = shown.filter((document) => document.status === "Ready");
  const allShownSelected = selectableShownDocuments.length > 0 && selectableShownDocuments.every((document) => selectedDocumentIds.has(document.id));

  function toggleDocumentSelection(documentId: string, checked: boolean) {
    setSelectedDocumentIds((current) => {
      const next = new Set(current);
      if (checked) next.add(documentId);
      else next.delete(documentId);
      return next;
    });
  }

  function toggleShownSelections(checked: boolean) {
    setSelectedDocumentIds((current) => {
      const next = new Set(current);
      selectableShownDocuments.forEach((document) => checked ? next.add(document.id) : next.delete(document.id));
      return next;
    });
  }

  async function buildModuleFromSelections() {
    if (!selectedDocuments.length) return;
    const documentsNeedingTraining = selectedDocuments.filter((document) => !document.trainingLessonId || document.trainingLessonStatus !== "ready");
    if (documentsNeedingTraining.length && !window.confirm(`${documentsNeedingTraining.length} selected document${documentsNeedingTraining.length === 1 ? " needs" : "s need"} a draft training lesson. Continue to generate those lessons from their approved knowledge?`)) return;

    setIsBuildingModule(true);
    setMessage(null);
    const lessonIds: string[] = [];
    const failedTitles: string[] = [];
    for (const document of selectedDocuments) {
      if (document.trainingLessonId && document.trainingLessonStatus === "ready") {
        lessonIds.push(document.trainingLessonId);
        continue;
      }

      const response = await fetch(`/api/knowledge/documents/${document.id}/training`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estimatedMinutes: 10, trainingType: "auto_detect", includeKnowledgeCheck: true }),
      });
      const result = await response.json().catch(() => ({ error: "Training generation could not be completed." }));
      if (response.ok && result.lessonId) lessonIds.push(String(result.lessonId));
      else failedTitles.push(document.title);
    }
    setIsBuildingModule(false);
    if (failedTitles.length) {
      setMessage({ type: "error", text: `Training could not be prepared for ${failedTitles.join(", ")}. No module was opened; correct those documents and try again.` });
      router.refresh();
      return;
    }
    router.push(`/admin/training?lessonIds=${encodeURIComponent([...new Set(lessonIds)].join(","))}`);
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setMessage(null);
    const response = await fetch("/api/knowledge/documents", { method: "POST", body: new FormData(event.currentTarget) });
    const result = await response.json().catch(() => ({ error: "The upload could not be completed." }));
    setUploading(false);
    if (!response.ok && !result.documentId) {
      setMessage({ type: "error", text: result.error || "The upload could not be completed." });
      return;
    }
    formRef.current?.reset();
    setCreateTraining(true);
    if (result.reviewUrl) {
      router.push(result.reviewUrl);
      return;
    }
    const failedStep = result.failedStep ? `${String(result.failedStep).replace(/^./, (letter: string) => letter.toUpperCase())} failed` : "Upload failed";
    setMessage({ type: result.failedStep ? "error" : "success", text: result.failedStep ? `Document saved. ${failedStep}: ${result.error}` : "Document uploaded and indexed securely." });
    router.refresh();
  }

  async function generateTraining(documentId: string) {
    setSavingDocumentId(documentId);
    setMessage(null);
    const response = await fetch(`/api/knowledge/documents/${documentId}/training`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ estimatedMinutes: 10, trainingType: "auto_detect", includeKnowledgeCheck: true }),
    });
    const result = await response.json().catch(() => ({ error: "Training generation could not be completed." }));
    setSavingDocumentId(null);
    if (result.reviewUrl) return router.push(result.reviewUrl);
    setMessage({ type: "error", text: `${result.failedStep ? `${result.failedStep} failed: ` : ""}${result.error || "Training generation could not be completed."}` });
    router.refresh();
  }

  function changeCollection(documentId: string, collection: string) {
    setSavingDocumentId(documentId);
    setMessage(null);
    startCollectionTransition(async () => {
      const result = await updateKnowledgeDocumentCollection(documentId, collection);
      setMessage({ type: result.error ? "error" : "success", text: result.error || result.success });
      setSavingDocumentId(null);
      if (!result.error) router.refresh();
    });
  }

  function reindex(documentId: string) {
    setSavingDocumentId(documentId);
    setMessage(null);
    startCollectionTransition(async () => {
      const result = await reindexKnowledgeDocument(documentId);
      setMessage({ type: result.error ? "error" : "success", text: result.error || result.success });
      setSavingDocumentId(null);
      router.refresh();
    });
  }

  return <div className={isRv ? "rv-knowledge-manager" : undefined}>
    {canManage && <form className={`card knowledge-upload ${isRv ? "rv-knowledge-upload" : ""}`} ref={formRef} onSubmit={uploadDocument}>
      <div><h2>{isRv ? "Add Knowledge to Your Library" : "Upload a document"}</h2><p>{isRv ? "Upload product guides, spec sheets, videos, training documents, and more. All files stay private and power approved answers." : "Original files stay private. Supported documents are indexed for grounded Sales Assistant answers."}</p></div>
      <div><label className="label" htmlFor="document-title">Title</label><input className="input" id="document-title" name="title" required maxLength={140} placeholder="2026 product guide"/></div>
      <div><label className="label" htmlFor="document-collection">Collection</label><select className="input" id="document-collection" name="collection">{KNOWLEDGE_COLLECTIONS.map((collection) => <option key={collection}>{collection}</option>)}</select></div>
      <div><label className="label" htmlFor="document-product">Product <small>(optional)</small></label><select className="input" id="document-product" name="productId"><option value="">All products / general knowledge</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>
      <div><label className="label" htmlFor="document-location">Location <small>(optional)</small></label><select className="input" id="document-location" name="locationId"><option value="">All locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
      <div><label className="label" htmlFor="document-file">File</label><input className="input file-input" id="document-file" name="file" type="file" required accept=".pdf,.docx,.md,.txt,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"/><small className="field-help">PDF, DOCX, Markdown, or text · maximum 4 MB</small></div>
      <label className="knowledge-training-option"><input checked={createTraining} name="addToTraining" type="checkbox" onChange={(event) => setCreateTraining(event.target.checked)}/><span><strong>Create Training Lesson</strong><small>Generate a 10-minute training lesson from this document for review.</small></span></label>
      {createTraining && <div className="knowledge-training-settings">
        <label><span className="label">Lesson Length</span><select className="input" name="lessonLength" defaultValue="10"><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option></select></label>
        <label><span className="label">Training Type</span><select className="input" name="trainingType" defaultValue="auto_detect"><option value="auto_detect">Auto Detect</option><option value="product_knowledge">Product Knowledge</option><option value="sales_skills">Sales Skills</option><option value="policy_process">Policy / Process</option><option value="competitor_knowledge">Competitor Knowledge</option><option value="general_knowledge">General Knowledge</option></select></label>
        <label><span className="label">Include Knowledge Check</span><select className="input" name="includeKnowledgeCheck" defaultValue="true"><option value="true">Yes</option><option value="false">No</option></select></label>
      </div>}
      <button className="btn btn-primary" disabled={uploading} type="submit">{uploading ? <><LoaderCircle className="spin" size={16}/> Uploading…</> : <><Upload size={16}/> Upload securely</>}</button>
      {message && <p className={message.type === "error" ? "form-error" : "form-success"} role="status">{message.text}</p>}
    </form>}
    <div className={`card ${isRv ? "rv-knowledge-library" : ""}`} style={{marginTop:18}}>
      {isRv && <nav className="rv-knowledge-tabs" aria-label="Knowledge library sections"><a className="active" href="#documents"><FileText/>Documents</a><a href="#documents"><BookOpenCheck/>Collections</a><Link href="/training"><BookOpenCheck/>Training Modules</Link></nav>}
      <div className="metric-row knowledge-table-head" id="documents"><div><h2>Documents</h2><p style={{fontSize:12,margin:0}}>Stored privately in the active workspace.</p></div><div className="knowledge-list-controls"><label className="knowledge-filter"><span>Collection</span><select className="input" value={collectionFilter} onChange={(event) => setCollectionFilter(event.target.value)}><option>All Collections</option>{KNOWLEDGE_COLLECTIONS.map((collection) => <option key={collection}>{collection}</option>)}</select></label><div style={{position:"relative",width:300,maxWidth:"100%"}}><Search size={15} style={{position:"absolute",left:11,top:12,color:"#68738a"}}/><input className="input" style={{paddingLeft:34}} value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search knowledge"/></div></div></div>
      {canManage ? <div className="knowledge-module-toolbar"><span>{selectedDocuments.length ? `${selectedDocuments.length} knowledge upload${selectedDocuments.length === 1 ? "" : "s"} selected` : "Select indexed knowledge uploads to build a module."}</span>{selectedDocuments.length ? <button className="btn btn-primary" type="button" disabled={isBuildingModule} onClick={buildModuleFromSelections}>{isBuildingModule ? <><LoaderCircle className="spin" size={16}/> Preparing lessons...</> : <><BookOpenCheck size={16}/> Build module with selected</>}</button> : null}</div> : null}
      {shown.length ? <div className="table-wrap"><table className="table"><thead><tr>{canManage && <th className="knowledge-select-cell"><input aria-label="Select all indexed documents shown" type="checkbox" checked={allShownSelected} disabled={selectableShownDocuments.length === 0} onChange={(event) => toggleShownSelections(event.target.checked)}/></th>}<th>Name</th><th>Collection</th><th>Size</th><th>Uploaded</th><th>Status</th>{canManage && <th>Actions</th>}</tr></thead><tbody>{shown.map((document) => {
        const canAddToModule = document.status === "Ready";
        return <tr key={document.id}>{canManage && <td className="knowledge-select-cell"><input aria-label={`Select ${document.title} for a training module`} type="checkbox" checked={selectedDocumentIds.has(document.id)} disabled={!canAddToModule} title={canAddToModule ? "Select for a training module" : "Finish indexing this document before adding it to a module."} onChange={(event) => toggleDocumentSelection(document.id, event.target.checked)}/></td>}<td><span className="document-name"><FileText size={16}/><span><strong>{document.title}</strong><small>{document.filename}</small></span></span></td><td>{canManage ? <select aria-label={`Collection for ${document.title}`} className="input knowledge-collection-select" value={document.collection} disabled={isCollectionPending && savingDocumentId === document.id} onChange={(event) => changeCollection(document.id, event.target.value)}>{KNOWLEDGE_COLLECTIONS.map((collection) => <option key={collection}>{collection}</option>)}</select> : document.collection}</td><td>{formatBytes(document.sizeBytes)}</td><td>{new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", year:"numeric" }).format(new Date(document.createdAt))}</td><td><span className={`badge ${["Error", "Failed"].includes(document.status) ? "amber" : document.status === "Ready" ? "blue" : ""}`}>{document.status === "Ready" ? `${document.chunkCount} chunks` : document.status}</span>{document.trainingLessonId ? <small className={document.trainingSourceReviewRequired ? "training-review-warning" : undefined}>{document.trainingSourceReviewRequired ? "Source Updated — Training Review Recommended" : document.trainingLessonPublished ? "Training published" : document.trainingLessonStatus === "failed" ? "Training generation failed" : "Training draft"}</small> : null}</td>{canManage && <td><div className="knowledge-row-actions"><button className="btn btn-secondary" type="button" disabled={isCollectionPending && savingDocumentId === document.id} onClick={() => reindex(document.id)}><RefreshCw className={isCollectionPending && savingDocumentId === document.id ? "spin" : ""} size={14}/> {document.chunkCount ? "Re-index" : "Index"}</button>{document.trainingLessonId && document.trainingLessonStatus !== "failed" ? <Link className="btn btn-secondary" href={`/training/${document.trainingLessonId}/review`} aria-label={`${document.trainingLessonPublished ? "Edit and republish" : "Review and publish"} training for ${document.title}`}><Pencil size={14}/> {document.trainingLessonPublished ? "Edit & republish" : "Review & publish"}</Link> : <button className="btn btn-secondary" type="button" disabled={savingDocumentId === document.id} onClick={() => generateTraining(document.id)}><BookOpenCheck size={14}/> {document.trainingLessonStatus === "failed" ? "Retry training" : "Create training"}</button>}<form action={deleteKnowledgeDocument} onSubmit={(event) => { if (!window.confirm(`Delete the knowledge upload “${document.title}”? This permanently removes its source file and indexed content.`)) event.preventDefault(); }}><input type="hidden" name="documentId" value={document.id}/><button className="btn btn-ghost danger-button" type="submit" aria-label={`Delete upload ${document.title}`}><Trash2 size={14}/> Delete upload</button></form></div></td>}</tr>;
      })}</tbody></table></div> : <div className="output empty"><div><FileText size={30}/><h2>{documents.length ? "No documents match" : "No documents yet"}</h2><p>{documents.length ? "Try a different search." : canManage ? "Upload the first approved document for this workspace." : "A tenant administrator has not uploaded any documents."}</p>{query && <button className="btn btn-secondary" onClick={()=>setQuery("")}>Clear search</button>}</div></div>}
    </div>
  </div>;
}
