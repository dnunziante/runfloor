import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const industryTemplateKey = await getViewerIndustryTemplateKey(viewer);
  return NextResponse.json({ ...viewer, industryTemplateKey });
}
