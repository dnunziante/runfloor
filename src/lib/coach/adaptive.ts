/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

export const coachSkills = ["Discovery", "Communication", "Product knowledge", "Value building", "Objection handling", "Closing", "NLP / language", "C.L.O.S.E.R.", "Organization / process"] as const;
export type CoachMode = "role_play" | "objection" | "challenge";
export type AdaptiveProfile = { overallScore: number; skillScores: Record<string, number>; strengths: string[]; weaknesses: string[]; trend: string; completedScenarios: string[]; objectionTypes: string[]; difficulty: "Foundational" | "Intermediate" | "Advanced"; recommendedFocus: string };

export const blankProfile: AdaptiveProfile = { overallScore: 0, skillScores: Object.fromEntries(coachSkills.map((skill) => [skill, 0])), strengths: [], weaknesses: [], trend: "Establishing a baseline", completedScenarios: [], objectionTypes: [], difficulty: "Foundational", recommendedFocus: "Discovery and customer priorities" };

export function profileFromRow(row: any | null): AdaptiveProfile {
  if (!row) return blankProfile;
  return { overallScore: Number(row.overall_score || 0), skillScores: { ...blankProfile.skillScores, ...(row.skill_scores || {}) }, strengths: row.recurring_strengths || [], weaknesses: row.recurring_weaknesses || [], trend: row.recent_trend || blankProfile.trend, completedScenarios: (row.completed_scenarios || []).map(String), objectionTypes: row.objection_types_practiced || [], difficulty: row.current_difficulty || "Foundational", recommendedFocus: row.recommended_focus || blankProfile.recommendedFocus };
}

export function nextDifficulty(score: number, current: AdaptiveProfile["difficulty"]): AdaptiveProfile["difficulty"] {
  if (score >= 84 && current === "Foundational") return "Intermediate";
  if (score >= 88 && current === "Intermediate") return "Advanced";
  if (score < 58 && current === "Advanced") return "Intermediate";
  return current;
}
/* eslint-disable @typescript-eslint/no-explicit-any */
