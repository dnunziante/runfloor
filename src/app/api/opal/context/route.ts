import { NextResponse } from "next/server";
import { helpViewer } from "@/lib/opal/viewer";
import { opalPreview } from "@/lib/opal/preview";
import { getOpalHelpAllowance } from "@/lib/opal/usage";

export async function GET() {
  const viewer = await helpViewer();
  if (!viewer || (viewer.demo && !opalPreview()))
    return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const allowance =
    viewer.demo && opalPreview()
      ? null
      : await getOpalHelpAllowance(viewer.organizationId, viewer.id);
  return NextResponse.json(
    {
      id: viewer.id,
      organizationId: viewer.organizationId,
      demo: viewer.demo,
      allowance,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
