import { AppShell } from "@/components/app-shell";
import { OperationsAlertManager } from "@/components/operations-alert-manager";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getOperationsWorkspace } from "@/lib/operations/repository";

export default async function OperationsAlertsPage() {
  const viewer = await getViewer();
  const [data, industryTemplateKey] = await Promise.all([
    getOperationsWorkspace(),
    viewer ? getViewerIndustryTemplateKey(viewer) : Promise.resolve(null),
  ]);
  const isRv = industryTemplateKey === "rv";
  const isGolfCart = industryTemplateKey === "golf-cart";

  return <AppShell title="Operational Alerts" industry={isRv ? "rv" : isGolfCart ? "golf-cart" : undefined}><OperationsAlertManager initialAlerts={data.alerts} persistence={data.persistence} initialError={data.error} isRv={isRv} isGolfCart={isGolfCart}/></AppShell>;
}
