import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExecutiveTargetEditor } from "@/components/executive-target-editor";
import { ExecutiveEscalationEditor } from "@/components/executive-escalation-editor";
import { PageHeader } from "@/components/page-header";
import { getExecutiveWorkspace } from "@/lib/executive/repository";
import { getExecutiveEscalationSettings } from "@/lib/executive/accountability-repository";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { RvExecutiveTargets } from "@/components/rv-executive-targets";

export default async function ExecutiveTargetSettingsPage() {
  const [data, escalationSettings, viewer] = await Promise.all([getExecutiveWorkspace(), getExecutiveEscalationSettings(), getViewer()]);
  if (!data.canEditTargets) redirect("/executive");
  if (viewer) {
    const templateKey = await getViewerIndustryTemplateKey(viewer);
    const workspaceName = viewer.organizationName.trim().toLowerCase();
    if (templateKey === "rv" || workspaceName === "runfloor demo" || workspaceName === "rayne rv") return <AppShell title="Executive Targets" industry="rv"><RvExecutiveTargets initialTargets={data.targets} initialSettings={escalationSettings.settings} persistence={data.persistence}/></AppShell>;
  }
  return <AppShell title="Executive Targets"><PageHeader eyebrow="Administrator settings" title="Define what needs leadership attention" description="Set organization-level targets and accountability rules used by the Executive Advisor’s transparent calculations." action={<Link className="btn btn-ghost" href="/executive"><ArrowLeft size={16}/> Command center</Link>}/><div className="callout executive-disclaimer"><Info size={20}/><div><strong>{data.persistence === "supabase" ? "Organization configuration" : "Temporary configuration"}</strong><p>{data.persistence === "supabase" ? "Saved settings apply only to this tenant. Source records and platform-wide methodology remain separate." : "Changes are temporary in local demo mode and do not update Supabase."}</p></div></div><div className="executive-settings-stack"><ExecutiveTargetEditor initialTargets={data.targets} persistence={data.persistence}/><ExecutiveEscalationEditor initialSettings={escalationSettings.settings} persistence={data.persistence}/></div></AppShell>;
}
