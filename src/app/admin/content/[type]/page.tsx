import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SalesContentManager, type SalesContentItem } from "@/components/sales-content-manager";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

const types: Record<string, { label: string; description: string }> = {
  sales_script: { label: "Sales scripts", description: "Add approved talk tracks and discovery prompts for the sales team." },
  objection_response: { label: "Objection responses", description: "Add approved answers to the questions and concerns representatives hear." },
  email_template: { label: "Email templates", description: "Add reusable approved emails for follow-up and customer communication." },
  text_template: { label: "Text templates", description: "Add reusable approved text messages for customer communication." },
};

export default async function SalesContentTypePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const config = types[type];
  if (!config) notFound();
  const viewer = await getViewer();
  const canManage = Boolean(viewer?.organizationId && !viewer.demo && ["tenant_admin", "platform_owner"].includes(viewer.role));
  let items: SalesContentItem[] = [];
  let categories: Array<{ id: string; name: string; position: number; archived: boolean }> = [];
  if (viewer?.organizationId && !viewer.demo) {
    const supabase = await createClient();
    const [{ data }, { data: categoryRows }] = await Promise.all([
      supabase.from("sales_content_items").select("id, title, body, status, category, tags, updated_at").eq("organization_id", viewer.organizationId).eq("content_type", type).order("updated_at", { ascending: false }),
      ["text_template", "email_template"].includes(type) ? supabase.from("text_template_categories").select("id,name,position,archived").eq("organization_id", viewer.organizationId).order("position") : Promise.resolve({ data: [] }),
    ]);
    items = (data || []).map((item) => ({ id: item.id, title: item.title, body: item.body, status: item.status as SalesContentItem["status"], category: item.category || "", tags: item.tags || [], updatedAt: item.updated_at }));
    categories = categoryRows || [];
  }
  return <AppShell title={`Admin · ${config.label}`}>{!["text_template", "email_template"].includes(type) && <PageHeader eyebrow="Sales content" title={config.label} description={config.description}/>}<SalesContentManager contentType={type} label={config.label} items={items} categories={categories} canManage={canManage}/></AppShell>;
}
