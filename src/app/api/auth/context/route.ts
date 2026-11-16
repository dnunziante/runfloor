import { opalPreview } from "@/lib/opal/preview";
import { helpViewer } from "@/lib/opal/viewer";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";

export async function GET() {
  if (opalPreview()) return NextResponse.json({ ...await helpViewer(), industryTemplateKey: "rv" });
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const industryTemplateKey = await getViewerIndustryTemplateKey(viewer);
  return NextResponse.json({ ...viewer, industryTemplateKey });
}
