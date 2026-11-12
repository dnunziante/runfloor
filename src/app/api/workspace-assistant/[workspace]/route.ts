import { selectWorkspaceContext } from "@/lib/assistant/workspace-context";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { assistantWorkspaces, canUseAssistant, conversationContext } from "@/lib/assistant/workspaces";
import { createWorkspaceAnswer } from "@/lib/rag/openai";
import { getOperationsWorkspace } from "@/lib/operations/repository";
import { getExecutiveWorkspace } from "@/lib/executive/repository";
import { getGrowthPlans } from "@/lib/growth/plans";
import { getExecutiveTrends } from "@/lib/executive/trends-repository";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  if (workspace !== "operations" && workspace !== "executive") return NextResponse.json({ error: "Unknown assistant." }, { status: 404 });
  const viewer = await getViewer();
  if (!viewer?.organizationId) return NextResponse.json({ error: "Sign in to your workspace." }, { status: 401 });
  if (!canUseAssistant(workspace, viewer.role)) return NextResponse.json({ error: "Executive AI requires management access." }, { status: 403 });
  if (viewer.demo) return NextResponse.json({ error: "Sign in to a connected workspace to ask AI questions using approved records." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 2 || question.length > 2000) return NextResponse.json({ error: "Enter a question between 2 and 2,000 characters." }, { status: 400 });
  try {
    // Each repository uses the authenticated client, active tenant and RLS.
    // No arbitrary table/tool names, tenant IDs or instructions come from the client.
    let context: string;
    let sourceName: string;
    let recordsAvailable = true;
    try {
      if (workspace === "operations") {
        const data = await getOperationsWorkspace();
        if (data.error) throw new Error("Operations sources unavailable");
        context = selectWorkspaceContext(question, { procedures: data.procedures.filter((procedure) => procedure.status === "Published"), checklists: data.checklists, alerts: data.alerts, schedules: data.schedules, handoffs: data.handoffs, incidents: data.incidents }, conversationContext(body?.history));
        sourceName = "Operations workspace — published procedures and authorized operational records";
      } else {
        const data = await getExecutiveWorkspace();
        if (!data.canView) return NextResponse.json({ error: "Executive access denied." }, { status: 403 });
        const supabase = await createClient();
        const [plans, trends, opportunities] = await Promise.all([
          getGrowthPlans(), getExecutiveTrends(),
          supabase.from("growth_opportunities").select("slug,title,summary,rationale,score,actions,measures").eq("organization_id", viewer.organizationId).eq("status", "published").limit(40),
        ]);
        if (data.error || plans.error || trends.error || opportunities.error) throw new Error("Executive sources unavailable");
        context = selectWorkspaceContext(question, { reportingPeriod: data.reportingPeriod, metrics: data.metrics, signals: data.signals, priorities: data.priorities, risks: data.risks, wins: data.wins, reviews: data.reviews, actionPlans: plans.plans, historicalTrends: trends.periods, growthOpportunities: opportunities.data ?? [] }, conversationContext(body?.history));
        sourceName = `Executive workspace — ${data.reportingPeriod} performance, priorities, reviews and action plans`;
      }
    } catch {
      recordsAvailable = false;
      sourceName = "RunFloor records unavailable";
      context = "Authorized workspace records could not be loaded. Do not infer that records are empty or that work is complete. Explain this limitation and provide General AI guidance where useful. Do not invent or cite company facts.";
    }
    const answer = await createWorkspaceAnswer(question, `[1] ${sourceName}\n${context}`, assistantWorkspaces[workspace].instructions, conversationContext(body?.history));
    return NextResponse.json({ answer, sources: recordsAvailable && /\[1\]/.test(answer) ? [{ documentName: sourceName }] : [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The assistant could not load approved workspace information or reach the AI service. Please try again." }, { status: 503 });
  }
}
