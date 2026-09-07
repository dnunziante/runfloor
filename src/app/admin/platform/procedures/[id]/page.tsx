import { notFound, redirect } from "next/navigation";
import { activeProcedureRows, isProcedureLibraryReady } from "@/lib/procedures/library-availability";
import { AppShell } from "@/components/app-shell";
import { ProcedureDocument } from "@/components/procedure-document";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { isPlatformTemplateEditor, templateColumns, templateReturnPath, type ProcedureTemplate } from "@/lib/procedures/document";

export default async function ProcedurePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ category?: string; templateSearch?: string; edit?: string }> }) {
  const viewer = await getViewer();
  if (!isPlatformTemplateEditor(viewer)) redirect("/admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const ready = await isProcedureLibraryReady("platform");
  const { data, error } = await activeProcedureRows(supabase.from("platform_procedure_templates").select(templateColumns).eq("id", id), ready).single();
  if (error || !data) notFound();
  const context = await searchParams;
  const { data: categories } = await supabase.from("platform_procedure_categories").select("name").is("archived_at", null).order("sort_order").order("name");
  return <AppShell title="Procedure Templates"><ProcedureDocument key={id} initial={data as ProcedureTemplate} initialEditing={context.edit === "1"} categories={categories?.map(item => item.name) ?? [(data as ProcedureTemplate).category]} backHref={templateReturnPath(context.category, context.templateSearch)} /></AppShell>;
}
