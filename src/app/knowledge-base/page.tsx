import { BookOpen, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { KnowledgeManager } from "@/components/knowledge-manager";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { getKnowledgeDocuments } from "@/lib/knowledge/data";
import { createClient } from "@/lib/supabase/server";

export default async function KnowledgeBasePage() {
  const [viewer, result] = await Promise.all([getViewer(), getKnowledgeDocuments()]);
  const canManage = Boolean(viewer && !viewer.demo && ["tenant_admin", "platform_owner"].includes(viewer.role));
  const supabase = canManage && viewer?.organizationId ? await createClient() : null;
  const [{ data: locationRows }, { data: productRows }] = supabase ? await Promise.all([
    supabase.from("locations").select("id, name").eq("organization_id", viewer!.organizationId).order("name"),
    supabase.from("products").select("id, name").eq("organization_id", viewer!.organizationId).order("name"),
  ]) : [{ data: [] }, { data: [] }];
  const readyCount = result.documents.filter((document)=>document.status === "Ready").length;
  const collections = new Set(result.documents.map((document)=>document.collection)).size;

  return <AppShell title="Knowledge Base">
    <PageHeader eyebrow="Approved team knowledge" title="Keep every answer grounded" description="Private source files are securely indexed so the Sales Assistant can answer from approved RunFloor knowledge." action={canManage ? <Link className="btn btn-primary" href="/admin/training">Build a module</Link> : null}/>
    {result.error ? <div className="card error-card"><h2>Knowledge Base unavailable</h2><p>{result.error}</p><p>Confirm the knowledge-document migration has been applied.</p></div> : <>
      <div className="grid grid-3"><div className="card"><div className="metric-row"><span>Documents</span><FileText color="#376fe8"/></div><div className="metric">{result.documents.length}</div><p>Private workspace files</p></div><div className="card"><div className="metric-row"><span>Collections</span><BookOpen color="#376fe8"/></div><div className="metric">{collections}</div><p>Organized by topic</p></div><div className="card"><div className="metric-row"><span>AI ready</span><ShieldCheck color="#16825d"/></div><div className="metric">{readyCount}</div><p>Indexing comes next</p></div></div>
      <KnowledgeManager documents={result.documents} canManage={canManage} locations={locationRows || []} products={productRows || []}/>
    </>}
  </AppShell>;
}
