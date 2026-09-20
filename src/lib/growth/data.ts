export type GrowthCategory = "Local market" | "Lead generation" | "Partnerships" | "Customer retention" | "Expansion";
export type GrowthScore = { impact: number; effort: number; confidence: number; cost: number; risk: number; alignment: number };
export type GrowthScoreWeights = GrowthScore;
export type GrowthOpportunity = {
  slug: string;
  title: string;
  category: GrowthCategory;
  summary: string;
  rationale: string;
  impact: "High" | "Medium";
  effort: "Low" | "Medium" | "High";
  timeframe: string;
  status: "Ready to review" | "Exploring";
  actions: string[];
  measures: string[];
  score: GrowthScore;
  lifecycleStatus?: string;
  progress?: number;
  dueDate?: string | null;
};

export type GrowthPlan = {
  id: string;
  opportunitySlug: string;
  title: string;
  locationId: string | null;
  locationName: string;
  owner: string;
  targetDate: string;
  targetMeasure: string;
  status: "Not started" | "In progress" | "Complete";
  tasks: Array<{ id?: string; title: string; complete: boolean }>;
  outcomes: GrowthOutcome[];
  createdAt: string;
};

export type GrowthOutcome = {
  id: string;
  date: string;
  leads: number;
  appointments: number;
  revenue: number;
  cost: number;
  notes: string;
  createdAt: string;
};

export const growthOpportunities: GrowthOpportunity[] = [
  { slug: "community-demo-days", title: "Launch neighborhood demo days", category: "Local market", summary: "Test small, location-led events that give nearby buyers a low-pressure way to experience a golf cart.", rationale: "This sample recommendation assumes each BGC location can identify nearby communities and host a small demonstration event.", impact: "High", effort: "Medium", timeframe: "30 days", status: "Ready to review", actions: ["Choose one pilot location", "Identify three nearby communities", "Create a simple event offer", "Track attendees, test drives, and follow-ups"], measures: ["Event registrations", "Completed test drives", "Appointments created"], score: { impact: 5, effort: 3, confidence: 3, cost: 3, risk: 2, alignment: 4 } },
  { slug: "past-buyer-referrals", title: "Activate past-buyer referrals", category: "Customer retention", summary: "Create a consistent referral follow-up for satisfied owners after delivery and service visits.", rationale: "Existing customer relationships may provide a lower-friction source of qualified conversations than cold outreach.", impact: "High", effort: "Low", timeframe: "14 days", status: "Ready to review", actions: ["Define the referral ask", "Select two customer touchpoints", "Create a follow-up template", "Review referrals by location weekly"], measures: ["Referral requests sent", "New referred leads", "Referral close rate"], score: { impact: 5, effort: 2, confidence: 4, cost: 2, risk: 2, alignment: 5 } },
  { slug: "local-partner-network", title: "Build a local partner network", category: "Partnerships", summary: "Pilot referral relationships with property managers, campgrounds, event venues, and service businesses.", rationale: "Organizations serving likely golf-cart users can introduce BGC to relevant local audiences.", impact: "Medium", effort: "Medium", timeframe: "45 days", status: "Exploring", actions: ["Create a partner profile", "Build a 20-business prospect list", "Draft a mutual-value offer", "Pilot with five partners"], measures: ["Partners contacted", "Active referral partners", "Partner-sourced leads"], score: { impact: 3, effort: 3, confidence: 3, cost: 2, risk: 3, alignment: 4 } },
  { slug: "lead-response-sprint", title: "Run a lead-response sprint", category: "Lead generation", summary: "Standardize the first 24 hours of follow-up and compare appointment rates across locations.", rationale: "A clear response cadence can make current lead activity easier to execute and measure.", impact: "High", effort: "Low", timeframe: "21 days", status: "Ready to review", actions: ["Map the current response process", "Set a first-response target", "Prepare call, text, and email steps", "Compare weekly appointment rates"], measures: ["Median response time", "Contact rate", "Appointments set"], score: { impact: 5, effort: 2, confidence: 4, cost: 1, risk: 2, alignment: 5 } },
  { slug: "mobile-service-feasibility", title: "Assess mobile service demand", category: "Expansion", summary: "Validate whether a limited mobile-service pilot could improve convenience and generate repeat business.", rationale: "This is a discovery opportunity only; demand, staffing, economics, and service boundaries require validation.", impact: "Medium", effort: "High", timeframe: "60 days", status: "Exploring", actions: ["Interview recent service customers", "Estimate a viable service radius", "Model staffing and vehicle costs", "Define pilot success criteria"], measures: ["Customer interest", "Estimated margin per visit", "Repeat-service potential"], score: { impact: 3, effort: 5, confidence: 2, cost: 5, risk: 4, alignment: 3 } },
];

export const rvGrowthOpportunities: GrowthOpportunity[] = growthOpportunities.map((item) => {
  if (item.slug === "community-demo-days") return { ...item, summary: "Test small, location-led events that give nearby shoppers a low-pressure way to explore RVs.", rationale: "This sample idea calls for a pilot location, local outreach, and a way to measure visits and follow-up appointments." };
  if (item.slug === "local-partner-network") return { ...item, rationale: "Local organizations may be useful referral partners. Validate the fit, audience, and value of each relationship before investing." };
  return item;
});

export const growthScoreWeights = { impact: 25, effort: 10, confidence: 20, cost: 15, risk: 10, alignment: 20 } as const;

export function calculateGrowthPriority(score: GrowthScore, weights: GrowthScoreWeights = growthScoreWeights) {
  const weighted = score.impact * weights.impact + (6 - score.effort) * weights.effort + score.confidence * weights.confidence + (6 - score.cost) * weights.cost + (6 - score.risk) * weights.risk + score.alignment * weights.alignment;
  return Math.round(weighted / 5);
}

export function growthPriorityLabel(value: number) { return value >= 80 ? "Prioritize" : value >= 65 ? "Validate next" : "Explore later"; }

export const growthCategories: Array<"All opportunities" | GrowthCategory> = ["All opportunities", "Local market", "Lead generation", "Partnerships", "Customer retention", "Expansion"];

export function getGrowthOpportunity(slug: string) {
  return growthOpportunities.find((opportunity) => opportunity.slug === slug);
}
