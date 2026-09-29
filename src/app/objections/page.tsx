import { AppShell } from "@/components/app-shell";
import { ObjectionHandling, type ObjectionResponse } from "@/components/objection-handling";
import { PageHeader } from "@/components/page-header";
import { TailoredObjections } from "@/components/tailored-objections";
import { getViewer } from "@/lib/auth/viewer";
import { objections as demoObjections } from "@/lib/data";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import styles from "./objections.module.css";

function splitResponse(body: string) {
  const [response, followUp] = body.split(/\n(?:follow[- ]?up|question)\s*:/i, 2);
  return { response: response.trim(), followUp: followUp?.trim() || "What would make the decision easier?" };
}

export default async function ObjectionsPage() {
  const viewer = await getViewer();
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspaceName = viewer?.organizationName.trim().toLowerCase() || "";
  const isGolfCart = templateKey === "golf-cart";
  const isRv = templateKey === "rv" || workspaceName === "runfloor rv" || workspaceName === "rayne rv";
  const tailored = Boolean(viewer && (isGolfCart || isRv || workspaceName === "runfloor demo"));
  const canManage = viewer?.role === "tenant_admin" || viewer?.role === "platform_owner";
  let objections: ObjectionResponse[] = demoObjections.map((item, index) => ({ id: `demo-${index}`, ...item }));
  if (!isLocalDemoMode() && isSupabaseConfigured()) {
    if (viewer?.organizationId) {
      const supabase = await createClient();
      const { data } = await supabase.from("sales_content_items").select("id,title,body").eq("organization_id", viewer.organizationId).eq("content_type", "objection_response").eq("status", "published").order("updated_at", { ascending: false });
      objections = (data || []).map((item) => ({ id: item.id, title: item.title, type: "Approved response", ...splitResponse(item.body) }));
    }
  }
  if (tailored) return <AppShell title="Objection Handling" industry={isGolfCart ? "golf-cart" : "rv"}><main className={`${styles.experience} ${isGolfCart ? styles.golfCartExperience : ""}`}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>Conversation coaching</span><h1>Turn hesitation into<br/>a <em>helpful conversation.</em></h1><p>{isGolfCart ? "Use approved guidance, real examples, and interactive practice to handle common objections and close more deals — on and off the golf course." : "Be prepared. Build confidence. Help customers make informed decisions."}</p><div className={styles.heroPoints}><span>Real dealership scenarios<small>Based on customer conversations</small></span><span>Expert guidance<small>Use approved responses</small></span><span>Practice &amp; improve<small>Build confidence with role play</small></span></div></div><blockquote>{isGolfCart ? <>Handle<br/>Objections.<br/>Keep The<br/>Conversation<br/>Rolling.</> : <>People<br/>Buy Freedom.</>}</blockquote></section>
    <TailoredObjections objections={objections} canManage={canManage} golfCart={isGolfCart}/>
  </main></AppShell>;
  return <AppShell title="Objection Handling"><PageHeader eyebrow="Conversation coaching" title="Turn hesitation into a helpful conversation" description="Use approved guidance for reference, then practice a live adaptive objection conversation."/><ObjectionHandling objections={objections}/></AppShell>;
}
