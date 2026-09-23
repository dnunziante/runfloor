import "server-only";
import * as XLSX from "xlsx";
import type { CoachDifficulty } from "./types";

export type ImportedCoachScenario = {
  clientId: string; title: string; category: string; difficulty: CoachDifficulty; durationMinutes: number;
  customerPersona: string; goal: string; opening: string; roundTwoPrompt: string; roundThreePrompt: string;
  skills: string[]; tags: string[]; responseOptions: string[]; rubricWeights: Record<string, number>;
  status: "draft" | "published" | "archived"; duplicateId?: string; duplicateReason?: string; validationIssues: string[];
};

const cell = (row: Record<string, unknown>, ...names: string[]) => String(names.map((name) => row[name]).find((value) => value !== undefined) || "").trim();
const list = (value: string, lineAware = false) => value.split(lineAware ? /\r?\n|\|/ : /[,;|]/).map((item) => item.trim()).filter(Boolean);
const weightNames = ["Clarify", "Listen", "Open", "Solve", "Explain", "Recommend"];

export async function parseScenarioSpreadsheet(file: File): Promise<ImportedCoachScenario[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const rows = workbook.SheetNames.flatMap((name) => XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: "" }));
  return rows.slice(0, 500).map((row, index) => {
    const title = cell(row, "Scenario Name", "scenario_name", "Title", "title").slice(0, 160);
    const category = cell(row, "Category", "category").slice(0, 120);
    const rawDifficulty = cell(row, "Difficulty", "difficulty") || "Foundational";
    const difficulty: CoachDifficulty = ["Foundational", "Intermediate", "Advanced"].includes(rawDifficulty) ? rawDifficulty as CoachDifficulty : "Foundational";
    const durationMinutes = Number(cell(row, "Duration Minutes", "duration_minutes") || 6);
    const customerPersona = cell(row, "Customer Persona", "customer_persona").slice(0, 2000);
    const goal = cell(row, "Practice Objective", "practice_objective", "Goal", "goal").slice(0, 4000);
    const opening = cell(row, "Customer Opening Statement", "customer_opening_statement", "Opening", "opening").slice(0, 4000);
    const roundTwoPrompt = cell(row, "Round 2 Prompt", "round_2_prompt").slice(0, 4000);
    const roundThreePrompt = cell(row, "Round 3 Prompt", "round_3_prompt").slice(0, 4000);
    const skills = list(cell(row, "Skills", "skills")).slice(0, 20), tags = list(cell(row, "Tags", "tags")).slice(0, 20);
    const responseOptions = list(cell(row, "Response Options", "response_options"), true).slice(0, 6);
    const rubricWeights = Object.fromEntries(weightNames.map((name) => [name, Number(cell(row, `Weight ${name}`, `weight_${name.toLowerCase()}`) || (name === "Clarify" || name === "Listen" ? 20 : 15))]));
    const rawStatus = cell(row, "Status", "status").toLowerCase() || "draft";
    const status = (["published", "archived"].includes(rawStatus) ? rawStatus : "draft") as ImportedCoachScenario["status"];
    const validationIssues: string[] = [];
    if (title.length < 2) validationIssues.push("Scenario name is required");
    if (!category) validationIssues.push("Category is required");
    if (!["Foundational", "Intermediate", "Advanced"].includes(rawDifficulty)) validationIssues.push("Difficulty must be Foundational, Intermediate, or Advanced");
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 60) validationIssues.push("Duration must be a whole number from 1 to 60");
    if (!customerPersona) validationIssues.push("Customer persona is required");
    if (!goal || !opening || !roundTwoPrompt || !roundThreePrompt) validationIssues.push("Objective and all three customer prompts are required");
    if (!skills.length) validationIssues.push("At least one skill is required");
    if (responseOptions.length < 2) validationIssues.push("Add two to six response options separated by | or line breaks");
    if (Object.values(rubricWeights).some((value) => !Number.isInteger(value) || value < 0 || value > 100) || Object.values(rubricWeights).reduce((a,b)=>a+b,0) !== 100) validationIssues.push("C.L.O.S.E.R. weights must be whole numbers totaling 100");
    if (!["draft", "published", "archived"].includes(rawStatus)) validationIssues.push("Status must be Draft, Published, or Archived");
    return { clientId: `scenario-${index + 1}`, title, category, difficulty, durationMinutes, customerPersona, goal, opening, roundTwoPrompt, roundThreePrompt, skills, tags, responseOptions, rubricWeights, status, validationIssues };
  }).filter((item) => item.title || item.category || item.opening);
}

export function flagScenarioDuplicates(items: ImportedCoachScenario[], existing: Array<{ id: string; title: string; slug: string }>) {
  return items.map((item) => { const match = existing.find((row) => row.title.trim().toLowerCase() === item.title.trim().toLowerCase()); return match ? { ...item, duplicateId: match.id, duplicateReason: "Exact scenario name match" } : item; });
}
