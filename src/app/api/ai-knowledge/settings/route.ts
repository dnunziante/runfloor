import { knowledgeAdmin, parseKnowledgeSettings, saveSettings } from "@/lib/knowledge-first/admin";
export async function PUT(request: Request) {
  const viewer = await knowledgeAdmin();
  if (!viewer) return Response.json({ error: "Administrator access to a connected dealership is required." }, { status: 403 });
  const value = parseKnowledgeSettings(await request.json().catch(() => null));
  if (!value) return Response.json({ error: "Choose valid modes, limits and public domains." }, { status: 400 });
  try { await saveSettings(viewer, value); return Response.json({ success: true }); }
  catch { return Response.json({ error: "Knowledge settings could not be saved." }, { status: 503 }); }
}
