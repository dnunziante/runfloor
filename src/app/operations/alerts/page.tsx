import { AppShell } from "@/components/app-shell";
import { OperationsAlertManager } from "@/components/operations-alert-manager";
import { getOperationsWorkspace } from "@/lib/operations/repository";

export default async function OperationsAlertsPage() {
  const data = await getOperationsWorkspace();
  return <AppShell title="Operational Alerts"><OperationsAlertManager initialAlerts={data.alerts} persistence={data.persistence} initialError={data.error}/></AppShell>;
}
