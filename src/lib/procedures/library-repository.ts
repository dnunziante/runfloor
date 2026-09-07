import "server-only";
import { getViewer } from "@/lib/auth/viewer";
import { canManageOperations } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { emptyLibrary, type LibrarySnapshot, type LibraryScope, type LibraryProcedure } from "./library";

export async function getProcedureLibrary(scope: LibraryScope): Promise<LibrarySnapshot> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || (scope === "platform" && viewer.role !== "platform_owner")) return emptyLibrary;
  const client = await createClient();
  const platform = scope === "platform";
  const canManage = platform || canManageOperations(viewer.role);
  let categories = client.from(platform ? "platform_procedure_categories" : "operations_procedure_categories")
    .select("id,name,description,style_name,sort_order,archived_at,archived_by").order("sort_order").order("name");
  let procedures = client.from(platform ? "platform_procedure_templates" : "operations_procedures")
    .select(`id,title,category,${platform ? "" : "category_id,"}archived_at,archived_by,original_category`).order("title");
  if (!platform) {
    categories = categories.eq("organization_id", viewer.organizationId);
    procedures = procedures.eq("organization_id", viewer.organizationId);
  }
  if (!canManage) { categories = categories.is("archived_at", null); procedures = procedures.is("archived_at", null); }
  const [categoryResult, procedureResult] = await Promise.all([categories, procedures]);
  if (categoryResult.error || procedureResult.error) {
    const cause = categoryResult.error || procedureResult.error;
    return { ...emptyLibrary, pendingMigration: ["42703", "42P01", "PGRST204", "PGRST205"].includes(cause?.code ?? ""), error: "The procedure management library could not be loaded. Please reload and try again." };
  }
  const rows = (procedureResult.data ?? []) as unknown as LibraryProcedure[];
  const personIds = [...new Set([...categoryResult.data, ...rows].flatMap(row => row.archived_by ? [row.archived_by] : []))];
  const { data: people } = personIds.length ? await client.from("profiles").select("id,full_name").in("id", personIds) : { data: [] };
  return { categories: categoryResult.data, procedures: rows, people: Object.fromEntries((people ?? []).map(person => [person.id, person.full_name || "Team member"])) };
}
