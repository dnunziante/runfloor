export type CoachDifficulty = "Foundational" | "Intermediate" | "Advanced";
export type CoachScenarioStatus = "Draft" | "Published" | "Archived";

export type CoachRound = {
  id: string;
  roundNumber: number;
  customerPrompt: string;
  responseOptions: string[];
  preferredOptionIndices: number[];
  skillImpacts: string[];
};

export type CoachScenario = {
  id: string;
  slug: string;
  title: string;
  category: string;
  difficulty: CoachDifficulty;
  durationMinutes: number;
  duration: string;
  customer: string;
  goal: string;
  opening: string;
  skills: string[];
  tags?: string[];
  responseOptions: string[];
  preferredOptionIndices: number[];
  rubricWeights: Record<string, number>;
  rounds: CoachRound[];
  status: CoachScenarioStatus;
  updatedAt?: string;
};

export type CoachScenarioResult = {
  scenarios: CoachScenario[];
  source: "supabase" | "demo";
  error?: string;
};

export type CoachSessionSummary = {
  id: string;
  scenarioTitle: string;
  scenarioSlug: string;
  category: string;
  difficulty: CoachDifficulty;
  score: number;
  closerScores: Array<[string, number]>;
  summary: string;
  strength: string;
  improvement: string;
  completedAt: string;
  participantName?: string;
  locationName?: string;
};

export type CoachDashboardData = {
  scenarios: CoachScenario[];
  recentSessions: CoachSessionSummary[];
  practiceSessions: number;
  averageScore: number | null;
  scopeLabel: string;
  source: "supabase" | "demo";
  error?: string;
};
