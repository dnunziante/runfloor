import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ImprovementIntake } from "@/components/improvement-intake";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";

export default async function NewImprovementPage() {
  const viewer = await getViewer();
  const shared = Boolean(viewer && !viewer.demo);
  return <AppShell title="Process Improvement"><PageHeader eyebrow="Employee submission" title="Tell us what could work better" description="You do not need to diagnose the cause or know the solution. Start with what you observed." action={<Link className="btn btn-ghost" href="/operations/improvements"><ArrowLeft size={16}/> Submissions</Link>}/><div className="callout operations-disclaimer"><Info size={20}/><div><strong>{shared ? "Protected workspace submission" : "Temporary submission"}</strong><p>{shared ? "Your submission is saved in this workspace for manager review." : "This form uses temporary sample behavior and does not save or notify a manager."}</p></div></div><ImprovementIntake persistence={shared ? "supabase" : "demo"}/></AppShell>;
}
