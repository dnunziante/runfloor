import "server-only";

import { getViewer } from "@/lib/auth/viewer";
import { getCoachSessionScope } from "@/lib/coach/access";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { demoCoachReview, demoCoachScenarios } from "./demo";
import type { CoachDashboardData, CoachDifficulty, CoachRound, CoachScenario, CoachScenarioResult, CoachScenarioStatus, CoachSessionSummary } from "./types";

type RoundRow = {
  id: string;
  round_number: number;
  customer_prompt: string;
  response_options: string[] | null;
  preferred_option_indices: number[] | null;
  skill_impacts: string[] | null;
};

export type ScenarioRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  difficulty: CoachDifficulty;
  duration_minutes: number;
  customer_persona: string;
  goal: string;
  opening: string;
  skills: string[] | null;
  tags: string[] | null;
  response_options: string[] | null;
  preferred_option_indices: number[] | null;
  rubric_weights: Record<string, number> | null;
  coach_scenario_rounds: RoundRow[] | null;
  status: "draft" | "published" | "archived";
  updated_at: string;
};

type SessionRow = {
  id: string;
  score: number;
  closer_scores: Record<string, number> | null;
  summary: string | null;
  strength: string | null;
  improvement: string | null;
  completed_at: string;
  profiles: { full_name: string | null } | null;
  locations: { name: string } | null;
  coach_scenarios: {
    title: string;
    slug: string;
    category: string;
    difficulty: CoachDifficulty;
  } | null;
};

const statusLabels: Record<ScenarioRow["status"], CoachScenarioStatus> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export function toScenario(row: ScenarioRow): CoachScenario {
  const rounds: CoachRound[] = (row.coach_scenario_rounds || []).map((round) => ({
    id: round.id,
    roundNumber: round.round_number,
    customerPrompt: round.customer_prompt,
    responseOptions: round.response_options || [],
    preferredOptionIndices: round.preferred_option_indices || [],
    skillImpacts: round.skill_impacts || [],
  })).sort((a, b) => a.roundNumber - b.roundNumber);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    difficulty: row.difficulty,
    durationMinutes: row.duration_minutes,
    duration: `${row.duration_minutes} min`,
    customer: row.customer_persona,
    goal: row.goal,
    opening: row.opening,
    skills: row.skills || [],
    tags: row.tags || [],
    responseOptions: row.response_options || [],
    preferredOptionIndices: row.preferred_option_indices || [],
    rubricWeights: row.rubric_weights || { Clarify: 20, Listen: 20, Open: 15, Solve: 15, Explain: 15, Recommend: 15 },
    rounds,
    status: statusLabels[row.status],
    updatedAt: row.updated_at,
  };
}

function toSession(row: SessionRow): CoachSessionSummary {
  const scenario = row.coach_scenarios;
  return {
    id: row.id,
    scenarioTitle: scenario?.title || "Practice scenario",
    scenarioSlug: scenario?.slug || "price-objection",
    category: scenario?.category || "Sales practice",
    difficulty: scenario?.difficulty || "Foundational",
    score: row.score,
    closerScores: Object.entries(row.closer_scores || {}).map(([skill, score]) => [skill, Number(score)]),
    summary: row.summary || "Session completed.",
    strength: row.strength || "You kept the conversation focused on the customer.",
    improvement: row.improvement || "Continue practicing one clear discovery question at a time.",
    completedAt: row.completed_at,
    participantName: row.profiles?.full_name || undefined,
    locationName: row.locations?.name || undefined,
  };
}

export async function getCoachScenarios(options: { includeDrafts?: boolean } = {}): Promise<CoachScenarioResult> {
  if (isLocalDemoMode() || !isSupabaseConfigured()) {
    return { scenarios: demoCoachScenarios, source: "demo" };
  }

  const viewer = await getViewer();
  if (!viewer?.organizationId) return { scenarios: [], source: "supabase", error: "Your account is not assigned to an organization." };

  const supabase = await createClient();
  let query = supabase
    .from("coach_scenarios")
    .select("id, slug, title, category, difficulty, duration_minutes, customer_persona, goal, opening, skills, tags, response_options, preferred_option_indices, rubric_weights, status, updated_at, coach_scenario_rounds(id, round_number, customer_prompt, response_options, preferred_option_indices, skill_impacts)")
    .eq("organization_id", viewer.organizationId)
    .order("created_at");

  if (!options.includeDrafts) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) return { scenarios: [], source: "supabase", error: "Practice scenarios could not be loaded." };

  return { scenarios: (data as ScenarioRow[]).map(toScenario), source: "supabase" };
}

export async function getCoachScenario(identifier?: string) {
  const result = await getCoachScenarios();
  const scenario = result.scenarios.find((item) => item.id === identifier || item.slug === identifier) || result.scenarios[0] || null;
  return { scenario, source: result.source, error: result.error };
}

async function getCompletedSessions(limit = 20): Promise<{ sessions: CoachSessionSummary[]; scopeLabel: string; error?: string }> {
  if (isLocalDemoMode() || !isSupabaseConfigured()) return { sessions: [demoCoachReview], scopeLabel: "All company locations" };

  const viewer = await getViewer();
  if (!viewer?.organizationId) return { sessions: [], scopeLabel: "Your practice", error: "Your account is not assigned to an organization." };

  const supabase = await createClient();
  const scope = await getCoachSessionScope(viewer);
  if (scope.kind === "locations" && !scope.locationIds.length) return { sessions: [], scopeLabel: scope.scopeLabel };

  let query = supabase
    .from("coach_sessions")
    .select("id, score, closer_scores, summary, strength, improvement, completed_at, coach_scenarios(title, slug, category, difficulty), profiles(full_name), locations(name)")
    .eq("organization_id", viewer.organizationId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (scope.kind === "self") query = query.eq("user_id", viewer.id);
  if (scope.kind === "locations") query = query.or(`user_id.eq.${viewer.id},location_id.in.(${scope.locationIds.join(",")})`);
  const { data, error } = await query;

  if (error) return { sessions: [], scopeLabel: scope.scopeLabel, error: "Practice history could not be loaded." };
  return { sessions: (data as unknown as SessionRow[]).map(toSession), scopeLabel: scope.scopeLabel };
}

export async function getCoachDashboardData(): Promise<CoachDashboardData> {
  const [scenarioResult, sessionResult] = await Promise.all([getCoachScenarios(), getCompletedSessions()]);
  const scores = sessionResult.sessions.map((session) => session.score);
  return {
    scenarios: scenarioResult.scenarios,
    recentSessions: sessionResult.sessions.slice(0, 4),
    practiceSessions: scenarioResult.source === "demo" ? 12 : sessionResult.sessions.length,
    averageScore: scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : null,
    scopeLabel: sessionResult.scopeLabel,
    source: scenarioResult.source,
    error: scenarioResult.error || sessionResult.error,
  };
}

export async function getCoachReview(sessionId?: string): Promise<{ review: CoachSessionSummary | null; error?: string; source: "supabase" | "demo" }> {
  if (isLocalDemoMode() || !isSupabaseConfigured()) return { review: demoCoachReview, source: "demo" };
  const result = await getCompletedSessions(50);
  return { review: result.sessions.find((session) => session.id === sessionId) || result.sessions[0] || null, error: result.error, source: "supabase" };
}

export async function getCoachReviewHistory() {
  return getCompletedSessions(50);
}
