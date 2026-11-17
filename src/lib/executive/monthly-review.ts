export type LeadershipAgendaInput = {
  priorityCount: number;
  escalationCount: number;
  overdueCount: number;
  unassignedCount: number;
  dueDecisionCount: number;
  openDecisionCount: number;
};

export type LeadershipAgendaItem = {
  title: string;
  explanation: string;
  href: string;
};

export function buildLeadershipAgenda(input: LeadershipAgendaInput): LeadershipAgendaItem[] {
  const agenda: LeadershipAgendaItem[] = [];
  if (input.escalationCount) agenda.push({ title: "Resolve escalated commitments", explanation: `${input.escalationCount} accountability notice${input.escalationCount === 1 ? " requires" : "s require"} leadership action.`, href: "/executive/accountability" });
  if (input.overdueCount) agenda.push({ title: "Review overdue ownership", explanation: `${input.overdueCount} reviewed priorit${input.overdueCount === 1 ? "y is" : "ies are"} overdue.`, href: "/executive/accountability" });
  if (input.unassignedCount) agenda.push({ title: "Assign open work", explanation: `${input.unassignedCount} active priorit${input.unassignedCount === 1 ? "y has" : "ies have"} no owner.`, href: "/executive/accountability" });
  if (input.dueDecisionCount) agenda.push({ title: "Validate decision outcomes", explanation: `${input.dueDecisionCount} open decision${input.dueDecisionCount === 1 ? " is" : "s are"} due for review.`, href: "/executive/decisions" });
  if (input.priorityCount) agenda.push({ title: "Confirm leadership priorities", explanation: `Review the ${input.priorityCount} calculated priorit${input.priorityCount === 1 ? "y" : "ies"} generated from approved source records.`, href: "/executive" });
  if (!agenda.length && input.openDecisionCount) agenda.push({ title: "Check open decisions", explanation: `${input.openDecisionCount} decision${input.openDecisionCount === 1 ? " remains" : "s remain"} open for a future outcome review.`, href: "/executive/decisions" });
  return agenda;
}
