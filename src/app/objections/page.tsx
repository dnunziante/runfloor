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
  const tailored = Boolean(viewer && (templateKey === "rv" || workspaceName === "runfloor demo" || workspaceName === "runfloor rv" || workspaceName === "rayne rv"));
  const canManage = viewer?.role === "tenant_admin" || viewer?.role === "platform_owner";
  let objections: ObjectionResponse[] = demoObjections.map((item, index) => ({ id: `demo-${index}`, ...item }));
  if (!isLocalDemoMode() && isSupabaseConfigured()) {
    if (viewer?.organizationId) {
      const supabase = await createClient();
      const { data } = await supabase.from("sales_content_items").select("id,title,body").eq("organization_id", viewer.organizationId).eq("content_type", "objection_response").eq("status", "published").order("updated_at", { ascending: false });
      objections = (data || []).map((item) => ({ id: item.id, title: item.title, type: "Approved response", ...splitResponse(item.body) }));
    }
  }
  if (tailored) return <AppShell title="Objection Handling" industry="rv"><main className={styles.experience}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>Conversation coaching</span><h1>Turn hesitation into<br/>a <em>helpful conversation.</em></h1><p>Be prepared. Build confidence. Help customers make informed decisions.</p><div className={styles.heroPoints}><span>Proven responses</span><span>Practice with purpose</span><span>Real conversations</span></div></div><blockquote>People<br/>Buy Freedom.</blockquote></section>
    <TailoredObjections objections={objections} canManage={canManage}/>
  </main></AppShell>;
  return <AppShell title="Objection Handling"><PageHeader eyebrow="Conversation coaching" title="Turn hesitation into a helpful conversation" description="Use approved guidance for reference, then practice a live adaptive objection conversation."/><ObjectionHandling objections={objections}/></AppShell>;
}
