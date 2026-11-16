import { NextResponse } from "next/server";
import { helpViewer } from "@/lib/opal/viewer";
import { opalPreview } from "@/lib/opal/preview";
export async function GET() { const v = await helpViewer(); return v && (!v.demo || opalPreview()) ? NextResponse.json({ id: v.id, organizationId: v.organizationId, demo: v.demo }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Sign in" }, { status: 401 }); }
