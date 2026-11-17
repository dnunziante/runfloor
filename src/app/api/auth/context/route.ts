import { demoLocations, getOrganizationLocations } from "@/lib/locations";
import { opalPreview } from "@/lib/opal/preview";
import { helpViewer } from "@/lib/opal/viewer";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";

export async function GET() {
  if (opalPreview()) return NextResponse.json({ ...await helpViewer(), industryTemplateKey: "rv", locations: demoLocations.map(location => location.name) });
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const industryTemplateKey = await getViewerIndustryTemplateKey(viewer);
  const locationResult = await getOrganizationLocations();
  return NextResponse.json({ ...viewer, industryTemplateKey, locations: locationResult.locations.map(location => location.name), locationError: locationResult.error });
}
