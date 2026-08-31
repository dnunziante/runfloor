import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OperationsProcedureManager } from "@/components/operations-procedure-manager";
import { PageHeader } from "@/components/page-header";
import { getOperationsWorkspace } from "@/lib/operations/repository";

export default async function OperationsProceduresPage() {
  const data = await getOperationsWorkspace(); const shared = data.persistence === "supabase";
  return <AppShell title="Operations Procedures"><PageHeader eyebrow="Standardize the work" title="Give every location one trusted way to operate" description="Find, review, and maintain clear step-by-step procedures for repeatable dealership operations." action={<Link className="btn btn-ghost" href="/operations"><ArrowLeft size={16}/> Operations dashboard</Link>}/><div className="callout operations-disclaimer"><Info size={20}/><div><strong>{shared ? "Protected procedure library" : "Browser-local procedure library"}</strong><p>{shared ? "Procedures and categories are stored for this organization and managed through tenant permissions." : "Demo changes are saved only in this browser and are not yet shared, approved, or connected to the Knowledge Base."}</p></div></div><OperationsProcedureManager initialProcedures={data.procedures} initialCategories={data.procedureCategories} persistence={data.persistence} initialError={data.error} canManage={data.canManage}/></AppShell>;
}
