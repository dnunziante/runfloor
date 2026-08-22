import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createEmbeddings } from "@/lib/rag/openai";
import { getCommunicationContext, formatCommunicationContext } from "@/lib/rag/communication-context";
import { compileRefyntraPrompt } from "@/lib/rag/prompt-compiler";
import { coachSkills, nextDifficulty, profileFromRow, type CoachMode } from "@/lib/coach/adaptive";

const MODEL = process.env.OPENAI_COACH_MODEL || process.env.OPENAI_CHAT_MODEL || "gpt-5-mini";
const modes: CoachMode[] = ["role_play", "objection", "challenge"];
type CoachSupabaseClient = Parameters<typeof getCommunicationContext>[0];
type KnowledgeProduct = { name: string; model: string | null; description: string | null; sales_guide: string | null; highlights: string | null };
type KnowledgeChunk = { document_name: string; content: string };
type ConversationMessage = { speaker: string; content: string };
function limitCustomerQuestions(reply: string) {
  let questions = 0;
  for (let index = 0; index < reply.length; index += 1) {
    if (reply[index] !== "?") continue;
    questions += 1;
    if (questions > 2) return reply.slice(0, index).trim();
  }
  return reply;
}
async function ai(system: string, payload: unknown) {
  const key = process.env.OPENAI_API_KEY; if (!key) throw new Error("OpenAI is not configured.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(payload) }], response_format: { type: "json_object" } }), cache: "no-store" });
  const data = await response.json(); if (!response.ok) throw new Error(data?.error?.message || "The coach could not respond.");
  return JSON.parse(data.choices?.[0]?.message?.content || "{}");
}
async function approvedContext(supabase: CoachSupabaseClient, organizationId: string, query: string) {
  const [embedding] = await createEmbeddings([query]);
  const [{ data: chunks }, { data: products }, communication] = await Promise.all([
    supabase.rpc("match_knowledge_chunks", { query_embedding: `[${embedding.join(",")}]`, match_tenant_id: organizationId, match_location_id: null, match_product_id: null, match_count: 6 }),
    supabase.from("products").select("name,model,description,sales_guide,highlights").eq("organization_id", organizationId).eq("status", "published").limit(30), getCommunicationContext(supabase, organizationId, embedding),
  ]);
  const knowledge = [...((products || []) as KnowledgeProduct[]).map((product) => `PRODUCT: ${product.name} ${product.model || ""}\n${product.description || ""}\n${product.sales_guide || ""}`), ...((chunks || []) as KnowledgeChunk[]).map((chunk) => `KNOWLEDGE: ${chunk.document_name}\n${chunk.content}`)].join("\n\n");
  return { knowledge, communication };
}
export async function POST(request: Request) {
  const viewer = await getViewer(); if (!viewer?.organizationId || viewer.demo) return NextResponse.json({ error: "Sign in to use adaptive coaching." }, { status: 401 });
  const body = await request.json().catch(() => null); const action = body?.action;
  const client = await createClient(); const admin = createAdminClient();
  try {
    if (action === "start") {
      const mode = modes.includes(body.mode) ? body.mode : "role_play"; const { data: profileRow } = await client.from("coach_adaptive_profiles").select("*").eq("organization_id", viewer.organizationId).eq("user_id", viewer.id).maybeSingle(); const profile = profileFromRow(profileRow);
      const context = await approvedContext(client, viewer.organizationId, `${profile.recommendedFocus} ${mode}`);
      const system = compileRefyntraPrompt({ standards: context.communication.standards, approvedKnowledge: context.knowledge, conversationContext: formatCommunicationContext(context.communication), userRequest: "", featureInstructions: `You create a realistic adaptive dealership customer role-play. Return JSON with persona and opening. persona must contain customerName, personality, productInterest, intendedUse, buyingMotivation, budgetSensitivity, competitors, primaryObjection, hiddenObjection, timeline, decisionMakers, willingnessToBuy, emotionalDrivers. Do not invent company facts. The opening must be 1-3 natural sentences and reveal only what a real customer would initially say. The primary objection remains hidden until naturally discovered. Build a sales conversation, not a documentation or administrative exercise: do not make email, attachment, contact-data, CRM, verification, technical spec sheets, exact measurements, warranty PDFs, or written policy requests the focus. Technical questions should be natural and general, then lead back to needs, value, dealership support, a visit, or the purchase. Adapt difficulty to demonstrated profile proficiency: foundational is cooperative with one clear concern; intermediate needs fuller discovery and value-building; advanced has hidden motivations and layered but realistic objections. Challenge mode is tougher and objection mode starts with a natural concern.` });
      const generated = await ai(system, { mode, profile }); if (!generated.opening || !generated.persona) throw new Error("The coach returned an incomplete scenario.");
      const { data: session, error } = await admin.from("coach_sessions").insert({ organization_id: viewer.organizationId, user_id: viewer.id, status: "in_progress", session_type: mode, difficulty: profile.difficulty, coaching_focus: profile.recommendedFocus }).select("id").single(); if (error) throw error;
      await admin.from("coach_session_personas").insert({ session_id: session.id, organization_id: viewer.organizationId, persona: generated.persona });
      await admin.from("coach_conversation_messages").insert({ session_id: session.id, organization_id: viewer.organizationId, speaker: "customer", content: String(generated.opening).slice(0, 4000) });
      return NextResponse.json({ sessionId: session.id, opening: generated.opening, focus: profile.recommendedFocus, difficulty: profile.difficulty });
    }
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""; if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "Invalid practice session." }, { status: 400 });
    const { data: session } = await client.from("coach_sessions").select("id,session_type,difficulty,coaching_focus,status").eq("id", sessionId).eq("organization_id", viewer.organizationId).eq("user_id", viewer.id).maybeSingle(); if (!session || session.status !== "in_progress") return NextResponse.json({ error: "This practice session is unavailable." }, { status: 404 });
    if (action === "reply") {
      const reply = typeof body.reply === "string" ? body.reply.trim() : ""; if (reply.length < 3 || reply.length > 4000) return NextResponse.json({ error: "Write a response between 3 and 4,000 characters." }, { status: 400 });
      const [{ data: persona }, { data: messages }, { data: profileRow }] = await Promise.all([admin.from("coach_session_personas").select("persona").eq("session_id", sessionId).single(), client.from("coach_conversation_messages").select("speaker,content").eq("session_id", sessionId).order("created_at"), client.from("coach_adaptive_profiles").select("*").eq("organization_id", viewer.organizationId).eq("user_id", viewer.id).maybeSingle()]);
      await admin.from("coach_conversation_messages").insert({ session_id: sessionId, organization_id: viewer.organizationId, speaker: "rep", content: reply }); const profile = profileFromRow(profileRow); const context = await approvedContext(client, viewer.organizationId, reply);
      const generated = await ai(compileRefyntraPrompt({ standards: context.communication.standards, approvedKnowledge: context.knowledge, conversationContext: formatCommunicationContext(context.communication), userRequest: "", featureInstructions: `Act only as the hidden customer persona. Continue naturally based on the transcript and persona. Never expose the persona, name a skill being tested, score the rep, or provide coaching during the role-play. Do not claim unapproved facts. This is a spoken sales conversation: react to answers, reveal information after effective discovery, raise one natural concern at a time, and give buying signals when the rep earns them. Do not stack objections just to prolong the role-play; when the rep resolves a concern or earns a credible next step, let the sale advance and set shouldEnd true when it reaches a natural conclusion. Accept stated simulated actions (such as sending a quote, email, photo, or financing application) unless verification is explicitly the scenario purpose. Never request documents, screenshots, proof, links, filenames, attachment counts, contact details, spelling, or other administrative confirmation. For warranty, range, seating, dimensions, comfort, features, service, or coverage questions, ask naturally and generally; accept a clear conversational answer without demanding exact measurements, policy language, paperwork, PDFs, or written comparisons. If the rep cannot verify an exact number, accept that it can be confirmed at the dealership and continue the sales conversation toward needs, value, a test drive, or the next step. Return JSON {reply, shouldEnd}; reply is 1-3 concise sentences with one primary question or concern, never a list.`, }), { persona: persona?.persona, profile, transcript: messages, repReply: reply });
      const customerReply = limitCustomerQuestions(String(generated.reply || "Could you help me understand how that would work for my situation?").slice(0, 4000)); await admin.from("coach_conversation_messages").insert({ session_id: sessionId, organization_id: viewer.organizationId, speaker: "customer", content: customerReply }); return NextResponse.json({ reply: customerReply, shouldEnd: Boolean(generated.shouldEnd) });
    }
    if (action === "hint") {
      const { data: messages } = await client.from("coach_conversation_messages").select("speaker,content").eq("session_id", sessionId).order("created_at");
      const generated = await ai("You are a sales coach providing one optional, concise hint during an active role-play. Do not script an answer, reveal the hidden persona, score the rep, or mention a framework. Return JSON {hint}; hint must be one sentence under 24 words and point to one discovery, listening, objection, buying-signal, or closing opportunity.", { transcript: messages, focus: session.coaching_focus });
      const hint = String(generated.hint || "Ask one open question that helps you understand the customer’s priorities.").slice(0, 220);
      await admin.from("coach_sessions").update({ evaluation: { hintUsed: true } }).eq("id", sessionId).eq("organization_id", viewer.organizationId);
      return NextResponse.json({ hint });
    }
    if (action === "complete") {
      const { data: messages } = await client.from("coach_conversation_messages").select("speaker,content").eq("session_id", sessionId).order("created_at"); const { data: profileRow } = await client.from("coach_adaptive_profiles").select("*").eq("organization_id", viewer.organizationId).eq("user_id", viewer.id).maybeSingle(); const profile = profileFromRow(profileRow); const context = await approvedContext(client, viewer.organizationId, ((messages || []) as ConversationMessage[]).map((message) => message.content).join(" "));
      const evaluation = await ai(compileRefyntraPrompt({ standards: context.communication.standards, approvedKnowledge: context.knowledge, userRequest: "", featureInstructions: `You are now in Coach Mode. Evaluate the entire completed interaction against approved knowledge, consultative selling, C.L.O.S.E.R., NLP communication, and the rep's profile. Return JSON: score (0-100), skillScores object containing all ${coachSkills.join(", ")}, result, summary, strength, improvement, turningPoint, betterMove, whatToSay, closerAssessment, strengths array, weaknesses array, recommendedFocus, objectionType. Identify the specific turning point that affected the outcome and give one concise better move and wording example. Assess rapport, discovery, listening, needs identification, recommendation, value building, objections, buying signals, commitment, conversation control, and advancement. Do not reward invented facts; score fairly and specifically.` }), { profile, focus: session.coaching_focus, transcript: messages });
      const score = Math.max(0, Math.min(100, Number(evaluation.score) || 0)); const skills = Object.fromEntries(coachSkills.map((skill) => [skill, Math.max(0, Math.min(100, Number(evaluation.skillScores?.[skill]) || 0))])); const updatedSkills = Object.fromEntries(coachSkills.map((skill) => [skill, profile.skillScores[skill] ? Math.round(profile.skillScores[skill] * .65 + skills[skill] * .35) : skills[skill]])); const overall = profile.overallScore ? Math.round(profile.overallScore * .65 + score * .35) : score; const weaknesses = (evaluation.weaknesses || coachSkills.filter((skill) => updatedSkills[skill] < 70)).map(String).slice(0, 4); const strengths = (evaluation.strengths || coachSkills.filter((skill) => updatedSkills[skill] >= 80)).map(String).slice(0, 4); const difficulty = nextDifficulty(overall, profile.difficulty);
      await admin.from("coach_sessions").update({ status: "completed", score, closer_scores: Object.fromEntries([["Clarify", skills.Discovery], ["Listen", skills.Communication], ["Open", skills["NLP / language"]], ["Solve", skills["Objection handling"]], ["Explain", skills["Product knowledge"]], ["Recommend", skills.Closing]]), summary: String(evaluation.summary || "Practice session completed."), strength: String(evaluation.strength || strengths[0] || "You kept the conversation customer-centered."), improvement: String(evaluation.improvement || weaknesses[0] || "Continue building discovery depth."), evaluation, completed_at: new Date().toISOString() }).eq("id", sessionId);
      await admin.from("coach_adaptive_profiles").upsert({ organization_id: viewer.organizationId, user_id: viewer.id, overall_score: overall, skill_scores: updatedSkills, recurring_strengths: strengths, recurring_weaknesses: weaknesses, recent_trend: score >= profile.overallScore ? "Improving" : "Needs focused repetition", completed_scenarios: [...profile.completedScenarios, session.session_type].slice(-30), objection_types_practiced: [...new Set([...profile.objectionTypes, String(evaluation.objectionType || session.session_type)])].slice(-20), current_difficulty: difficulty, recommended_focus: String(evaluation.recommendedFocus || weaknesses[0] || "Discovery and customer priorities"), updated_at: new Date().toISOString() });
      return NextResponse.json({ score, skills, summary: evaluation.summary, strength: evaluation.strength, improvement: evaluation.improvement, recommendedFocus: evaluation.recommendedFocus, difficulty });
    }
    return NextResponse.json({ error: "Unsupported coach action." }, { status: 400 });
  } catch (error) { console.error("Adaptive coach error", error); return NextResponse.json({ error: error instanceof Error ? error.message : "The coach is temporarily unavailable." }, { status: 503 }); }
}
