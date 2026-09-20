import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { blankProfile, coachSkills, profileFromRow } from "@/lib/coach/adaptive";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { TailoredDevelopment } from "@/components/tailored-development";

export default async function DevelopmentPage() {
  const viewer = await getViewer(); let profile = blankProfile;
  if (viewer?.organizationId && !viewer.demo) { const supabase = await createClient(); const { data } = await supabase.from("coach_adaptive_profiles").select("*").eq("organization_id", viewer.organizationId).eq("user_id", viewer.id).maybeSingle(); profile = profileFromRow(data); }
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspace = viewer?.organizationName.trim().toLowerCase() || "";
  if (viewer && (templateKey === "rv" || workspace === "runfloor demo" || workspace === "runfloor rv" || workspace === "rayne rv")) return <TailoredDevelopment profile={profile}/>;
  return <AppShell title="My Development"><PageHeader eyebrow="Persistent coaching profile" title="Your development plan" description="Your profile follows you across sessions and adapts the next customer conversation." action={<Link className="btn btn-primary" href="/coach/session">Start recommended practice</Link>}/><div className="grid grid-3"><section className="card"><span className="label">Overall coaching score</span><div className="metric">{profile.overallScore || "—"}{profile.overallScore ? "%" : ""}</div><p>{profile.trend}</p></section><section className="card"><span className="label">Current difficulty</span><h2>{profile.difficulty}</h2><p>Recommended focus: {profile.recommendedFocus}</p></section><section className="card"><span className="label">Practice history</span><div className="metric">{profile.completedScenarios.length}</div><p>{profile.objectionTypes.length} objection types practiced</p></section></div><section className="card"><h2>Skill development</h2><div className="coach-scores">{coachSkills.map((skill) => <div key={skill}><span>{skill}</span><div className="progress"><span style={{ width: `${profile.skillScores[skill] || 0}%` }}/></div><strong>{profile.skillScores[skill] || "—"}</strong></div>)}</div></section><div className="grid grid-2"><section className="card"><h2>Recurring strengths</h2><p>{profile.strengths.length ? profile.strengths.join(" · ") : "Complete a session to establish strengths."}</p></section><section className="card"><h2>Focus next</h2><p>{profile.weaknesses.length ? profile.weaknesses.join(" · ") : profile.recommendedFocus}</p></section></div></AppShell>;
}
