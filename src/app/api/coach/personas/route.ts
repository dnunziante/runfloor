import { ENABLE_SALES_COACHING } from "@/lib/features";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!ENABLE_SALES_COACHING) return NextResponse.json({ error: "Sales Coaching is temporarily unavailable." }, { status: 403 });
  const viewer = await getViewer();
  if (!viewer?.organizationId || viewer.demo) return NextResponse.json({ templates: [] });
  const supabase = await createClient();
  const { data, error } = await supabase.from("coach_persona_templates").select("id,name,archetype,difficulty").eq("organization_id", viewer.organizationId).eq("is_active", true).order("name");
  if (error) return NextResponse.json({ error: "Persona templates are unavailable." }, { status: 500 });
  return NextResponse.json({ templates: data || [] });
}
