import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { KnowledgeSettingsForm, type KnowledgeAccessDocument } from "@/components/knowledge-settings";
import { knowledgeAdmin } from "@/lib/knowledge-first/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeSettings } from "@/lib/knowledge-first/policy";
import Link from "next/link";
import styles from "@/components/knowledge-first.module.css";
export default async function KnowledgeSettingsPage() {
  const viewer = await knowledgeAdmin();
  let saved = null; let documents: KnowledgeAccessDocument[] = []; let failed = false; let searches = 0;
  if (viewer) {
    const db = await createClient();
    const [settings, docs, usage] = await Promise.all([
      db.from("ai_knowledge_settings").select("*").eq("organization_id", viewer.organizationId).maybeSingle(),
      db.from("knowledge_documents").select("id,title,assistant_scopes,knowledge_authority,management_only,knowledge_expires_at").eq("organization_id", viewer.organizationId).neq("context_type", "communication_example").order("created_at", { ascending: false }).limit(500),
      db.from("ai_research_requests").select("id", { count: "exact", head: true }).eq("organization_id", viewer.organizationId).gte("created_at", `${new Date().toISOString().slice(0, 10)}T00:00:00Z`),
    ]);
    saved = settings.data; documents = docs.data ?? []; searches = usage.count ?? 0; failed = Boolean(settings.error || docs.error || usage.error);
  }
  const configured = Boolean(process.env.OPENAI_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.AI_EXTERNAL_RESEARCH_ENABLED !== "false" && (!process.env.AI_RESEARCH_PROVIDER || process.env.AI_RESEARCH_PROVIDER === "openai"));
  return <AppShell title="Knowledge Settings"><PageHeader eyebrow="Executive · AI Configuration" title="Knowledge Settings" description="Control how Sales and Operations use approved knowledge and public research."/><section className={styles.panel}><h2>{viewer?.organizationName || "Connected dealership required"}</h2>{!viewer ? <p>Sign in as a dealership administrator to view and change these settings. Demo previews do not save changes.</p> : failed ? <p role="alert">Knowledge configuration could not be loaded. Check that the knowledge-first migration is installed.</p> : <p>{searches} public research requests today (UTC). {configured ? "Public research connection is configured." : "Public research connection requires server configuration. Internal knowledge remains available."}</p>}<Link href="/admin/ai-knowledge/gaps">View knowledge coverage, research usage and gaps →</Link></section><KnowledgeSettingsForm initial={normalizeSettings(saved ?? {})} documents={documents} disabled={!viewer || failed}/></AppShell>;
}
