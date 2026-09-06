import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProcedureDocument } from "@/components/procedure-document";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { isPlatformTemplateEditor, templateColumns, templateReturnPath, type ProcedureTemplate } from "@/lib/procedures/document";

export default async function ProcedurePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ category?: string; templateSearch?: string }> }) {
  const viewer = await getViewer();
  if (!isPlatformTemplateEditor(viewer)) redirect("/admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("platform_procedure_templates").select(templateColumns).eq("id", id).single();
  if (error || !data) notFound();
  const context = await searchParams;
  return <AppShell title="Procedure Templates"><ProcedureDocument key={id} initial={data as ProcedureTemplate} backHref={templateReturnPath(context.category, context.templateSearch)} /></AppShell>;
}
