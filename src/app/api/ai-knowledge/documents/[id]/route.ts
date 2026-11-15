import { knowledgeAdmin } from "@/lib/knowledge-first/admin";
import { createAdminClient } from "@/lib/supabase/admin";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await knowledgeAdmin();
  if (!viewer) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.scopes) || !body.scopes.every((scope: unknown) => scope === "sales" || scope === "operations") || !["uploaded", "approved", "policy"].includes(body.authority) || typeof body.managementOnly !== "boolean" || (body.expiresAt && !Number.isFinite(Date.parse(body.expiresAt)))) return Response.json({ error: "Choose valid access and authority settings." }, { status: 400 });
  const { data, error } = await createAdminClient().from("knowledge_documents").update({ assistant_scopes: [...new Set(body.scopes)], knowledge_authority: body.authority, management_only: body.managementOnly, knowledge_expires_at: body.expiresAt || null }).eq("id", id).eq("organization_id", viewer.organizationId).neq("context_type", "communication_example").select("id").maybeSingle();
  return error || !data ? Response.json({ error: "The document settings could not be saved." }, { status: 400 }) : Response.json({ success: true });
}
