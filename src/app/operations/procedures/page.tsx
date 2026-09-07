import { AppShell } from "@/components/app-shell";
import { OperationsProcedureManager } from "@/components/operations-procedure-manager";
import { getOperationsWorkspace } from "@/lib/operations/repository";
import { getProcedureLibrary } from "@/lib/procedures/library-repository";
import { ProcedureLibraryManagement } from "@/components/procedure-library-management";

export default async function OperationsProceduresPage() {
  const [data, snapshot] = await Promise.all([getOperationsWorkspace(), getProcedureLibrary("tenant")]);
  const manager = <OperationsProcedureManager key={JSON.stringify([data.procedures.map(item => [item.id,item.updatedAt]),data.procedureCategories])} managementReady={!snapshot.error && data.persistence !== "demo"} initialProcedures={data.procedures} initialCategories={data.procedureCategories} persistence={data.persistence} initialError={data.error} canManage={data.canManage}/>;
  return <AppShell title="Procedure Templates">{data.persistence === "demo" ? manager : <ProcedureLibraryManagement scope="tenant" snapshot={snapshot} canManage={data.canManage}>{manager}</ProcedureLibraryManagement>}</AppShell>;
}
