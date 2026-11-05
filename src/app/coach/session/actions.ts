"use server";

import { assertSalesCoachingEnabled } from "@/lib/features";
import { getViewer } from "@/lib/auth/viewer";
import { resolveCoachSessionLocation } from "@/lib/coach/access";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type CompleteCoachSessionResult = { sessionId?: string; error?: string };

type RoundRow = {
  round_number: number;
  customer_prompt: string;
  response_options: string[];
  preferred_option_indices: number[];
  skill_impacts: string[];
};

const defaultSkills = ["Clarify", "Listen", "Open", "Solve", "Explain", "Recommend"];

function calculateScores(rounds: RoundRow[], choices: number[], weights: Record<string, number>) {
  const skillResults = new Map<string, number[]>();
  rounds.forEach((round, index) => {
    const value = round.preferred_option_indices.includes(choices[index]) ? 88 : 58;
    round.skill_impacts.forEach((skill) => skillResults.set(skill, [...(skillResults.get(skill) || []), value]));
  });

  const closerScores = Object.fromEntries(defaultSkills.map((skill) => {
    const values = skillResults.get(skill) || [70];
    return [skill, Math.round(values.reduce((total, value) => total + value, 0) / values.length)];
  }));
  const totalWeight = defaultSkills.reduce((total, skill) => total + Number(weights[skill] || 0), 0) || 100;
  const score = Math.round(defaultSkills.reduce((total, skill) => total + closerScores[skill] * Number(weights[skill] || 0), 0) / totalWeight);
  return { score, closerScores };
}

export async function completeCoachSession(scenarioId: string, selectedOptionIndices: number[], locationId: string | null): Promise<CompleteCoachSessionResult> {
  assertSalesCoachingEnabled();
  if (isLocalDemoMode() || !isSupabaseConfigured()) return { sessionId: "demo-review" };
  if (!/^[0-9a-f-]{36}$/i.test(scenarioId) || !Array.isArray(selectedOptionIndices)) return { error: "That practice response is invalid." };

  const viewer = await getViewer();
  if (!viewer?.organizationId) return { error: "Your account is not assigned to an organization." };

  const supabase = await createClient();
  const location = await resolveCoachSessionLocation(viewer, locationId);
  if (location.error || !location.locationId) return { error: location.error || "A practice location is required." };
  const { data: scenario, error: scenarioError } = await supabase
    .from("coach_scenarios")
    .select("id, rubric_weights, coach_scenario_rounds(round_number, customer_prompt, response_options, preferred_option_indices, skill_impacts)")
    .eq("id", scenarioId)
    .eq("organization_id", viewer.organizationId)
    .eq("status", "published")
    .maybeSingle();

  if (scenarioError || !scenario) return { error: "This scenario is no longer available." };
  const rounds = ((scenario.coach_scenario_rounds || []) as RoundRow[]).sort((a, b) => a.round_number - b.round_number);
  if (!rounds.length || selectedOptionIndices.length !== rounds.length) return { error: "Complete every round before finishing the session." };
  if (rounds.some((round, index) => !round.response_options[selectedOptionIndices[index]])) return { error: "One or more selected responses are invalid." };

  const { score, closerScores } = calculateScores(rounds, selectedOptionIndices, (scenario.rubric_weights || {}) as Record<string, number>);
  const strongSession = score >= 80;
  const summary = strongSession ? "You used discovery, explanation, and a clear next step across the full conversation." : "You completed the conversation, but moved toward answers before fully exploring the customer's priorities.";
  const strongestSkill = Object.entries(closerScores).sort((a, b) => b[1] - a[1])[0]?.[0] || "Listen";
  const growthSkill = Object.entries(closerScores).sort((a, b) => a[1] - b[1])[0]?.[0] || "Recommend";
  const strength = `${strongestSkill} was your strongest C.L.O.S.E.R. skill in this session.`;
  const improvement = `Focus your next practice on ${growthSkill.toLowerCase()} before moving to the next stage of the conversation.`;

  const { data: session, error: sessionError } = await supabase.from("coach_sessions").insert({
    organization_id: viewer.organizationId,
    scenario_id: scenario.id,
    user_id: viewer.id,
    location_id: location.locationId,
    status: "in_progress",
  }).select("id").single();
  if (sessionError || !session) return { error: "The practice session could not be saved." };

  const responseRows = rounds.map((round, index) => {
    const preferred = round.preferred_option_indices.includes(selectedOptionIndices[index]);
    return {
      organization_id: viewer.organizationId,
      session_id: session.id,
      round_number: round.round_number,
      customer_prompt: round.customer_prompt,
      response_text: round.response_options[selectedOptionIndices[index]],
      selected_option_index: selectedOptionIndices[index],
      score: preferred ? 88 : 58,
      feedback: preferred ? "This response advanced a consultative conversation." : "This response moved forward before enough discovery.",
    };
  });
  const { error: responseError } = await supabase.from("coach_responses").insert(responseRows);
  if (responseError) return { error: "The session was started, but its round responses could not be saved." };

  const { error: completionError } = await supabase.from("coach_sessions").update({
    status: "completed",
    score,
    closer_scores: closerScores,
    summary,
    strength,
    improvement,
    completed_at: new Date().toISOString(),
  }).eq("id", session.id).eq("organization_id", viewer.organizationId).eq("user_id", viewer.id);
  if (completionError) return { error: "The responses were saved, but the session could not be completed." };
  return { sessionId: session.id };
}
