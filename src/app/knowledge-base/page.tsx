import { ArrowRight, BarChart3, BookOpen, FileText, GraduationCap, Library, ShieldCheck, Upload, Users } from "lucide-react";
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
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const isRv = templateKey === "rv";
  const isGolfCart = templateKey === "golf-cart";
  const canManage = Boolean(viewer && !viewer.demo && ["tenant_admin", "platform_owner"].includes(viewer.role));
  const supabase = canManage && viewer?.organizationId ? await createClient() : null;
  const [{ data: locationRows }, { data: productRows }] = supabase ? await Promise.all([
    supabase.from("locations").select("id, name").eq("organization_id", viewer!.organizationId).order("name"),
    supabase.from("products").select("id, name").eq("organization_id", viewer!.organizationId).order("name"),
  ]) : [{ data: [] }, { data: [] }];
  const readyCount = result.documents.filter((document)=>document.status === "Ready").length;
  const collections = new Set(result.documents.map((document)=>document.collection)).size;
  const trainingCount = result.documents.filter((document) => Boolean(document.trainingLessonId)).length;

  return <AppShell title="Knowledge Base" industry={isRv ? "rv" : isGolfCart ? "golf-cart" : undefined}>
    <main className={isRv ? "rv-knowledge" : isGolfCart ? "golf-cart-knowledge" : undefined}>
    {isRv ? <section className="rv-knowledge-hero">
      <div><span>Knowledge Base</span><h1>Knowledge<br/><em>Drives Confidence.</em></h1><p>Keep your team equipped with the latest product information, selling tools, and training resources — all in one place.</p><div className="rv-knowledge-benefits"><b><BookOpen/>Better<small>Conversations</small></b><b><Users/>Faster<small>Onboarding</small></b><b><ShieldCheck/>Consistent<small>Information</small></b><b><BarChart3/>Stronger<small>Sales Results</small></b></div></div>
      <blockquote>Adventure Knows<br/>No Limits.</blockquote>
    </section> : isGolfCart ? <><section className="gck-hero"><div><span>Approved team knowledge</span><h1>Your Golf Cart <em>Knowledge Hub</em></h1><p>Keep every answer, guide, and resource organized so your team can help customers with confidence.</p><div><b><BookOpen/>Easy to find<small>Search or browse by topic</small></b><b><Users/>Team ready<small>Approved and accurate</small></b><b><GraduationCap/>Build training<small>Turn documents into lessons</small></b><b><ShieldCheck/>Always current<small>Re-indexed for the assistant</small></b></div></div><blockquote>KNOW<br/>TRAIN<br/>SELL<br/>GROW</blockquote></section><section className="gck-actions" aria-label="Knowledge Base actions"><a className="primary" href="#knowledge-upload"><Upload/><span><strong>Upload a document</strong><small>Add guides, spec sheets, and training files.</small><i>Upload document <ArrowRight/></i></span></a><a href="#documents"><Library/><span><strong>Browse collections</strong><small>Find content by topic, product, or department.</small><i>View collections <ArrowRight/></i></span></a><Link href="/admin/training"><GraduationCap/><span><strong>Create training lesson</strong><small>Turn approved knowledge into team training.</small><i>Create training <ArrowRight/></i></span></Link></section></> : <PageHeader eyebrow="Approved team knowledge" title="Keep every answer grounded" description="Private source files are securely indexed so the Sales Assistant can answer from approved RunFloor knowledge." action={canManage ? <Link className="btn btn-primary" href="/admin/training">Build a module</Link> : null}/>}
    {result.error ? <div className="card error-card"><h2>Knowledge Base unavailable</h2><p>{result.error}</p><p>Confirm the knowledge-document migration has been applied.</p></div> : <>
      {!isGolfCart && <div className={isRv ? "rv-knowledge-metrics" : "grid grid-3"}><div className="card"><FileText/><div><strong>{result.documents.length}</strong><span>Documents</span><small>Private workspace files</small></div></div><div className="card"><BookOpen/><div><strong>{collections}</strong><span>Collections</span><small>Organized by topic</small></div></div>{isRv && <div className="card"><GraduationCap/><div><strong>{trainingCount}</strong><span>Training Modules</span><small>Ready for your team</small></div></div>}<div className="card"><ShieldCheck/><div><strong>{readyCount}</strong><span>AI Ready</span><small>Approved and indexed</small></div></div>{isRv && canManage && <Link className="btn btn-primary" href="/admin/training"><GraduationCap/> Build a Module</Link>}</div>}
      <KnowledgeManager documents={result.documents} canManage={canManage} locations={locationRows || []} products={productRows || []} isRv={isRv} isGolfCart={isGolfCart}/>
    </>}
    </main>
  </AppShell>;
}
