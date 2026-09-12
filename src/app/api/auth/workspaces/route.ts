import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = await createClient();
  if (viewer.role === "platform_owner") {
    const { data, error } = await supabase.from("organizations").select("id,name").eq("status", "active").order("name");
    return error ? NextResponse.json({ error: "Workspaces could not be loaded" }, { status: 500 }) : NextResponse.json({ workspaces: data || [] });
  }
  const { data, error } = await supabase.from("organization_memberships").select("organization_id, organizations(id,name)").eq("user_id", viewer.id).eq("status", "active").order("created_at");
  if (error) return NextResponse.json({ error: "Workspaces could not be loaded" }, { status: 500 });
  const workspaces = (data || []).flatMap((row) => row.organizations || []);
  return NextResponse.json({ workspaces });
}

export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  const { organizationId } = await request.json().catch(() => ({}));
  if (!viewer || viewer.demo || typeof organizationId !== "string" || !/^[0-9a-f-]{36}$/i.test(organizationId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = await createClient();
  const { data: organization } = await supabase.from("organizations").select("id").eq("id", organizationId).eq("status", "active").maybeSingle();
  if (!organization) return NextResponse.json({ error: "Workspace not available" }, { status: 404 });
  const { error } = await supabase.from("platform_workspace_contexts").upsert({ user_id: viewer.id, active_organization_id: organization.id, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Workspace could not be changed" }, { status: 500 });
  return NextResponse.json({ changed: true });
}
