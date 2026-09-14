import { BarChart3, BookOpen, FileText, GraduationCap, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { KnowledgeManager } from "@/components/knowledge-manager";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { getKnowledgeDocuments } from "@/lib/knowledge/data";
import { createClient } from "@/lib/supabase/server";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";

export default async function KnowledgeBasePage() {
  const [viewer, result] = await Promise.all([getViewer(), getKnowledgeDocuments()]);
  const isRv = viewer ? await getViewerIndustryTemplateKey(viewer) === "rv" : false;
  const canManage = Boolean(viewer && !viewer.demo && ["tenant_admin", "platform_owner"].includes(viewer.role));
  const supabase = canManage && viewer?.organizationId ? await createClient() : null;
  const [{ data: locationRows }, { data: productRows }] = supabase ? await Promise.all([
    supabase.from("locations").select("id, name").eq("organization_id", viewer!.organizationId).order("name"),
    supabase.from("products").select("id, name").eq("organization_id", viewer!.organizationId).order("name"),
  ]) : [{ data: [] }, { data: [] }];
  const readyCount = result.documents.filter((document)=>document.status === "Ready").length;
  const collections = new Set(result.documents.map((document)=>document.collection)).size;
  const trainingCount = result.documents.filter((document) => Boolean(document.trainingLessonId)).length;

  return <AppShell title="Knowledge Base" industry={isRv ? "rv" : undefined}>
    <main className={isRv ? "rv-knowledge" : undefined}>
    {isRv ? <section className="rv-knowledge-hero">
      <div><span>Knowledge Base</span><h1>Knowledge<br/><em>Drives Confidence.</em></h1><p>Keep your team equipped with the latest product information, selling tools, and training resources — all in one place.</p><div className="rv-knowledge-benefits"><b><BookOpen/>Better<small>Conversations</small></b><b><Users/>Faster<small>Onboarding</small></b><b><ShieldCheck/>Consistent<small>Information</small></b><b><BarChart3/>Stronger<small>Sales Results</small></b></div></div>
      <blockquote>Adventure Knows<br/>No Limits.</blockquote>
    </section> : <PageHeader eyebrow="Approved team knowledge" title="Keep every answer grounded" description="Private source files are securely indexed so the Sales Assistant can answer from approved RunFloor knowledge." action={canManage ? <Link className="btn btn-primary" href="/admin/training">Build a module</Link> : null}/>}
    {result.error ? <div className="card error-card"><h2>Knowledge Base unavailable</h2><p>{result.error}</p><p>Confirm the knowledge-document migration has been applied.</p></div> : <>
      <div className={isRv ? "rv-knowledge-metrics" : "grid grid-3"}><div className="card"><FileText/><div><strong>{result.documents.length}</strong><span>Documents</span><small>Private workspace files</small></div></div><div className="card"><BookOpen/><div><strong>{collections}</strong><span>Collections</span><small>Organized by topic</small></div></div>{isRv && <div className="card"><GraduationCap/><div><strong>{trainingCount}</strong><span>Training Modules</span><small>Ready for your team</small></div></div>}<div className="card"><ShieldCheck/><div><strong>{readyCount}</strong><span>AI Ready</span><small>Approved and indexed</small></div></div>{isRv && canManage && <Link className="btn btn-primary" href="/admin/training"><GraduationCap/> Build a Module</Link>}</div>
      <KnowledgeManager documents={result.documents} canManage={canManage} locations={locationRows || []} products={productRows || []} isRv={isRv}/>
    </>}
    </main>
  </AppShell>;
}
