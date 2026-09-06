import { AppShell } from "@/components/app-shell";
import { OperationsProcedureManager } from "@/components/operations-procedure-manager";
import { getOperationsWorkspace } from "@/lib/operations/repository";

export default async function OperationsProceduresPage() {
  const data = await getOperationsWorkspace();
  return <AppShell title="Procedure Templates"><OperationsProcedureManager initialProcedures={data.procedures} initialCategories={data.procedureCategories} persistence={data.persistence} initialError={data.error} canManage={data.canManage}/></AppShell>;
}
