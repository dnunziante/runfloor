export type OperationsChecklist = {
  id: string;
  title: string;
  location: string;
  owner: string;
  due: string;
  completed: number;
  total: number;
  status: "On track" | "Needs attention" | "Complete";
};

export type OperationsChecklistRecord = {
  id: string;
  title: string;
  location: string;
  owner: string;
  dueDate: string;
  steps: Array<{ id: string; title: string; complete: boolean }>;
  createdAt: string;
};

export const operationsChecklistRecords: OperationsChecklistRecord[] = [
  { id: "opening-charleston", title: "Dealership opening checklist", location: "Charleston", owner: "Opening Manager", dueDate: "2026-08-10", createdAt: "2026-08-09T09:00:00.000Z", steps: [
    { id: "opening-1", title: "Unlock customer entrances and complete safety walk", complete: true },
    { id: "opening-2", title: "Confirm showroom carts are clean and positioned", complete: true },
    { id: "opening-3", title: "Check demo-cart charge levels", complete: false },
    { id: "opening-4", title: "Review today’s appointments and deliveries", complete: false },
  ] },
  { id: "delivery-readiness", title: "Customer delivery readiness", location: "All locations", owner: "Delivery Team", dueDate: "2026-08-11", createdAt: "2026-08-09T09:05:00.000Z", steps: [
    { id: "delivery-1", title: "Confirm the approved cart and accessories", complete: true },
    { id: "delivery-2", title: "Complete final quality inspection", complete: false },
    { id: "delivery-3", title: "Prepare customer documents and orientation", complete: false },
  ] },
];

export const operationsChecklists: OperationsChecklist[] = [
  { id: "opening-charleston", title: "Dealership opening checklist", location: "Charleston", owner: "Opening Manager", due: "9:00 AM", completed: 8, total: 10, status: "On track" },
  { id: "delivery-readiness", title: "Customer delivery readiness", location: "All locations", owner: "Delivery Team", due: "Before pickup", completed: 5, total: 7, status: "Needs attention" },
  { id: "closing-summerville", title: "End-of-day closing", location: "Summerville", owner: "Closing Manager", due: "6:00 PM", completed: 6, total: 6, status: "Complete" },
];

export const operationsProcedures = [
  { title: "New cart delivery preparation", category: "Delivery", owner: "Operations", updated: "Sample procedure" },
  { title: "Customer test-drive safety", category: "Sales floor", owner: "Store Manager", updated: "Sample procedure" },
  { title: "Daily showroom opening", category: "Store operations", owner: "Opening Manager", updated: "Sample procedure" },
];

export const operationsAlerts = [
  { title: "Two delivery steps remain incomplete", detail: "Review the delivery-readiness checklist before the next scheduled pickup.", level: "Needs attention", location: "All locations" },
];

export type OperationsProcedureRecord = {
  id: string;
  title: string;
  categoryId: string;
  category: string;
  owner: string;
  summary: string;
  steps: string[];
  status: "Draft" | "Published";
  version: number;
  updatedAt: string;
  content?: Record<string, unknown>;
  sourceType?: "manual" | "ai_generated" | "imported" | "assistant_generated";
};

export const operationsProcedureRecords: OperationsProcedureRecord[] = [
  { id: "delivery-preparation", title: "New cart delivery preparation", categoryId: "delivery-post-sale", category: "Delivery & Post-Sale", owner: "Operations Manager", summary: "Prepare the approved cart, documents, and customer orientation before the scheduled pickup.", status: "Published", version: 1, updatedAt: "2026-08-09T10:00:00.000Z", steps: ["Match the cart serial number to the customer order", "Confirm installed accessories and requested configuration", "Complete the final quality and cleanliness inspection", "Prepare delivery documents and customer orientation topics"] },
  { id: "test-drive-safety", title: "Customer test-drive safety", categoryId: "sales-procedures", category: "Sales Procedures", owner: "Store Manager", summary: "Provide a consistent safety briefing and confirm the approved test-drive route.", status: "Published", version: 1, updatedAt: "2026-08-09T10:10:00.000Z", steps: ["Verify the selected cart is approved for demonstration", "Explain controls, seat belts, and safe operating expectations", "Confirm the designated route and expected return time", "Inspect the cart after the drive and report concerns"] },
  { id: "showroom-opening", title: "Daily showroom opening", categoryId: "employee-administrative", category: "Employee & Administrative", owner: "Opening Manager", summary: "Prepare the customer-facing showroom and team workspace before opening.", status: "Draft", version: 1, updatedAt: "2026-08-09T10:20:00.000Z", steps: ["Complete the opening safety walk", "Position and inspect showroom carts", "Review appointments, deliveries, and staffing", "Confirm customer areas are clean and ready"] },
];

export type OperationsProcedureCategory = { id: string; name: string; isDefault: boolean };
export const defaultOperationsProcedureCategories: OperationsProcedureCategory[] = [["sales-procedures", "Sales Procedures"], ["delivery-post-sale", "Delivery & Post-Sale"], ["inventory", "Inventory"], ["service", "Service"], ["parts", "Parts"], ["crm-lead-management", "CRM & Lead Management"], ["customer-experience", "Customer Experience"], ["management", "Management"], ["employee-administrative", "Employee & Administrative"], ["other", "Other"], ["uncategorized", "Uncategorized"]].map(([id, name]) => ({ id, name, isDefault: true }));

export type OperationsAlertRecord = {
  id: string;
  title: string;
  detail: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  location: string;
  owner: string;
  dueDate: string;
  status: "Open" | "Acknowledged" | "Resolved";
  createdAt: string;
  history: Array<{ id: string; status: "Open" | "Acknowledged" | "Resolved"; note: string; changedAt: string }>;
};

export const operationsAlertRecords: OperationsAlertRecord[] = [
  { id: "delivery-steps", title: "Delivery-readiness steps incomplete", detail: "Two required preparation steps remain incomplete before the scheduled customer pickup.", severity: "High", location: "Charleston", owner: "Delivery Team", dueDate: "2026-08-10", status: "Open", createdAt: "2026-08-09T11:00:00.000Z", history: [{ id: "delivery-history-1", status: "Open", note: "Alert created from the sample delivery workflow.", changedAt: "2026-08-09T11:00:00.000Z" }] },
  { id: "demo-charge", title: "Demo-cart charge check pending", detail: "One showroom demo cart still needs its charge level confirmed before opening.", severity: "Medium", location: "Summerville", owner: "Opening Manager", dueDate: "2026-08-10", status: "Acknowledged", createdAt: "2026-08-09T11:10:00.000Z", history: [{ id: "charge-history-1", status: "Open", note: "Alert created.", changedAt: "2026-08-09T11:10:00.000Z" }, { id: "charge-history-2", status: "Acknowledged", note: "Opening Manager accepted responsibility.", changedAt: "2026-08-09T11:20:00.000Z" }] },
  { id: "showroom-walk", title: "Showroom safety walk completed", detail: "The opening safety walk was documented and no issues were found.", severity: "Low", location: "Charleston", owner: "Opening Manager", dueDate: "2026-08-09", status: "Resolved", createdAt: "2026-08-09T08:00:00.000Z", history: [{ id: "walk-history-1", status: "Open", note: "Opening verification requested.", changedAt: "2026-08-09T08:00:00.000Z" }, { id: "walk-history-2", status: "Resolved", note: "Safety walk completed with no exceptions.", changedAt: "2026-08-09T08:30:00.000Z" }] },
];

export type OperationsScheduleRecord = {
  id: string;
  procedureId: string;
  procedureTitle: string;
  frequency: "Daily" | "Weekly" | "Monthly";
  location: string;
  owner: string;
  nextRunDate: string;
  status: "Active" | "Paused";
  lastGeneratedAt: string | null;
  createdAt: string;
};

export const operationsScheduleRecords: OperationsScheduleRecord[] = [
  { id: "daily-opening-charleston", procedureId: "showroom-opening", procedureTitle: "Daily showroom opening", frequency: "Daily", location: "Charleston", owner: "Opening Manager", nextRunDate: "2026-08-10", status: "Active", lastGeneratedAt: null, createdAt: "2026-08-09T12:00:00.000Z" },
  { id: "weekly-test-drive", procedureId: "test-drive-safety", procedureTitle: "Customer test-drive safety", frequency: "Weekly", location: "All locations", owner: "Store Manager", nextRunDate: "2026-08-15", status: "Active", lastGeneratedAt: null, createdAt: "2026-08-09T12:10:00.000Z" },
];

export type OperationsHandoffRecord = { id: string; location: string; fromShift: string; toShift: string; summary: string; unresolvedIssues: string; decisions: string; owner: string; status: "Open" | "Acknowledged" | "Closed"; createdAt: string; updatedAt: string };

export const operationsHandoffRecords: OperationsHandoffRecord[] = [
  { id: "charleston-evening", location: "Charleston", fromShift: "Opening", toShift: "Closing", summary: "Showroom and delivery queue reviewed before shift change.", unresolvedIssues: "Demo-cart charge check still needs confirmation.", decisions: "Closing Manager will verify the charge level before locking the showroom.", owner: "Closing Manager", status: "Open", createdAt: "2026-08-09T16:30:00.000Z", updatedAt: "2026-08-09T16:30:00.000Z" },
  { id: "summerville-opening", location: "Summerville", fromShift: "Closing", toShift: "Opening", summary: "Customer areas reset and keys secured.", unresolvedIssues: "None reported.", decisions: "Opening Manager will complete the safety walk as scheduled.", owner: "Opening Manager", status: "Acknowledged", createdAt: "2026-08-09T08:00:00.000Z", updatedAt: "2026-08-09T08:15:00.000Z" },
];

export type OperationsIncidentRecord = { id: string; title: string; category: "Safety" | "Customer" | "Equipment" | "Process" | "Other"; severity: "Low" | "Medium" | "High" | "Critical"; location: string; occurredAt: string; reportedBy: string; description: string; immediateAction: string; rootCause: string; correctiveAction: string; owner: string; dueDate: string; status: "Reported" | "Investigating" | "Corrective Action" | "Verified Closed"; createdAt: string; updatedAt: string };

export const operationsIncidentRecords: OperationsIncidentRecord[] = [
  { id: "demo-cart-cable", title: "Damaged demo-cart charging cable", category: "Equipment", severity: "High", location: "Charleston", occurredAt: "2026-08-09T14:15", reportedBy: "Opening Manager", description: "A charging cable was found with visible insulation damage during the afternoon inspection.", immediateAction: "Cable removed from service and the charging area marked unavailable.", rootCause: "Under investigation.", correctiveAction: "Inspect all charging cables and replace the damaged unit before reopening the station.", owner: "Operations Manager", dueDate: "2026-08-11", status: "Investigating", createdAt: "2026-08-09T14:30:00.000Z", updatedAt: "2026-08-09T14:30:00.000Z" },
];
