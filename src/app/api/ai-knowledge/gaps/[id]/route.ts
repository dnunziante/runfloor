import { knowledgeAdmin, parseGapDraft, saveGapDraft } from "@/lib/knowledge-first/admin";
export const maxDuration = 120;
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await knowledgeAdmin();
  if (!viewer) return Response.json({ error: "Administrator access to a connected dealership is required." }, { status: 403 });
  const { id } = await params;
  const draft = parseGapDraft(await request.json().catch(() => null));
  if (!/^[\da-f-]{36}$/i.test(id) || !draft) return Response.json({ error: "Enter a title, reviewed answer, collection and assistant access." }, { status: 400 });
  try { return Response.json(await saveGapDraft(viewer, id, draft)); }
  catch (error) { return Response.json({ error: error instanceof Error && /already|indexing failed|not found/.test(error.message) ? error.message : "The knowledge review could not be saved. Please try again." }, { status: 503 }); }
}
