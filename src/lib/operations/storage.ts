import { operationsAlertRecords, operationsChecklistRecords, operationsHandoffRecords, operationsIncidentRecords, operationsProcedureRecords, operationsScheduleRecords, type OperationsAlertRecord, type OperationsChecklistRecord, type OperationsHandoffRecord, type OperationsIncidentRecord, type OperationsProcedureRecord, type OperationsScheduleRecord } from "@/lib/operations/data";

export const operationsChecklistStorageKey = "commandly-demo-operations-checklists";
export const operationsProcedureStorageKey = "commandly-demo-operations-procedures";
export const operationsAlertStorageKey = "commandly-demo-operations-alerts";
export const operationsScheduleStorageKey = "commandly-demo-operations-schedules";
export const operationsHandoffStorageKey = "commandly-demo-operations-handoffs";
export const operationsIncidentStorageKey = "commandly-demo-operations-incidents";

export function readOperationsChecklists(): OperationsChecklistRecord[] {
  const saved = window.localStorage.getItem(operationsChecklistStorageKey);
  if (!saved) return operationsChecklistRecords;
  const parsed: unknown = JSON.parse(saved);
  return Array.isArray(parsed) ? parsed as OperationsChecklistRecord[] : operationsChecklistRecords;
}

export function writeOperationsChecklists(checklists: OperationsChecklistRecord[]) {
  window.localStorage.setItem(operationsChecklistStorageKey, JSON.stringify(checklists));
}

export function readOperationsProcedures(): OperationsProcedureRecord[] {
  const saved = window.localStorage.getItem(operationsProcedureStorageKey);
  if (!saved) return operationsProcedureRecords;
  const parsed: unknown = JSON.parse(saved);
  return Array.isArray(parsed) ? parsed as OperationsProcedureRecord[] : operationsProcedureRecords;
}

export function writeOperationsProcedures(procedures: OperationsProcedureRecord[]) {
  window.localStorage.setItem(operationsProcedureStorageKey, JSON.stringify(procedures));
}

export function readOperationsAlerts(): OperationsAlertRecord[] {
  const saved = window.localStorage.getItem(operationsAlertStorageKey);
  if (!saved) return operationsAlertRecords;
  const parsed: unknown = JSON.parse(saved);
  return Array.isArray(parsed) ? parsed as OperationsAlertRecord[] : operationsAlertRecords;
}

export function writeOperationsAlerts(alerts: OperationsAlertRecord[]) {
  window.localStorage.setItem(operationsAlertStorageKey, JSON.stringify(alerts));
}

export function readOperationsSchedules(): OperationsScheduleRecord[] {
  const saved = window.localStorage.getItem(operationsScheduleStorageKey);
  if (!saved) return operationsScheduleRecords;
  const parsed: unknown = JSON.parse(saved);
  return Array.isArray(parsed) ? parsed as OperationsScheduleRecord[] : operationsScheduleRecords;
}

export function writeOperationsSchedules(schedules: OperationsScheduleRecord[]) {
  window.localStorage.setItem(operationsScheduleStorageKey, JSON.stringify(schedules));
}

export function readOperationsHandoffs(): OperationsHandoffRecord[] {
  const saved = window.localStorage.getItem(operationsHandoffStorageKey);
  if (!saved) return operationsHandoffRecords;
  const parsed: unknown = JSON.parse(saved);
  return Array.isArray(parsed) ? parsed as OperationsHandoffRecord[] : operationsHandoffRecords;
}

export function writeOperationsHandoffs(handoffs: OperationsHandoffRecord[]) { window.localStorage.setItem(operationsHandoffStorageKey, JSON.stringify(handoffs)); }

export function readOperationsIncidents(): OperationsIncidentRecord[] { const saved = window.localStorage.getItem(operationsIncidentStorageKey); if (!saved) return operationsIncidentRecords; const parsed: unknown = JSON.parse(saved); return Array.isArray(parsed) ? parsed as OperationsIncidentRecord[] : operationsIncidentRecords; }
export function writeOperationsIncidents(incidents: OperationsIncidentRecord[]) { window.localStorage.setItem(operationsIncidentStorageKey, JSON.stringify(incidents)); }

export function formatOperationsDate(value: string) {
  const [year, month, day] = value.split("T")[0].split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day).toLocaleDateString() : "Not set";
}
