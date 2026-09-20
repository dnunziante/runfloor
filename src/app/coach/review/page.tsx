import Link from "next/link";
import { ArrowRight, CheckCircle2, RefreshCw, Target, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { getCoachReview } from "@/lib/coach/data";
import { getCoachReviewHistory } from "@/lib/coach/data";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { TailoredCoachReview } from "@/components/tailored-coach-review";

export default async function CoachReviewPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session: sessionId } = await searchParams;
  const viewer = await getViewer();
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const workspace = viewer?.organizationName.trim().toLowerCase() || "";
  const tailored = Boolean(viewer && (templateKey === "rv" || workspace === "runfloor demo" || workspace === "runfloor rv" || workspace === "rayne rv"));
  if (tailored) {
    const history = await getCoachReviewHistory();
    return <TailoredCoachReview sessions={history.sessions} selectedId={sessionId} error={history.error}/>;
  }
  const result = await getCoachReview(sessionId);
  if (!result.review) return <AppShell title="Session Review"><PageHeader eyebrow="Practice history" title="No completed sessions yet" description={result.error || "Complete a practice scenario to create your first saved review."} action={<Link className="btn btn-primary" href="/coach/scenarios"><RefreshCw size={16}/> Start practice</Link>}/><div className="output empty"><div><h2>Your reviews will appear here</h2><p>Scores and feedback are saved after each completed session.</p></div></div></AppShell>;

  const review = result.review;
  return <AppShell title="Session Review"><PageHeader eyebrow="Practice complete" title="You created space for a useful conversation" description="Review your performance, recognize what worked, and focus your next practice session." action={<Link className="btn btn-primary" href="/coach/scenarios"><RefreshCw size={16}/> Practice again</Link>}/>
    <div className="coach-review-grid"><section className="card coach-score-card"><span className="coach-score-ring">{review.score}<small>%</small></span><div><span className="badge"><Trophy size={13}/> Completed session</span><h2>{review.scenarioTitle} · {review.difficulty}</h2><p>{review.summary}</p></div></section><section className="card"><h2>C.L.O.S.E.R. breakdown</h2><div className="coach-scores">{review.closerScores.map(([skill, score]) => <div key={skill}><span>{skill}</span><div className="progress"><span style={{ width: `${score}%` }}/></div><strong>{score}</strong></div>)}</div></section></div>
    <div className="grid grid-2 coach-review-notes"><section className="card"><span className="badge"><CheckCircle2 size={13}/> Strength</span><h2>What worked well</h2><p>{review.strength}</p></section><section className="card"><span className="badge amber"><Target size={13}/> Improve next</span><h2>One skill to sharpen</h2><p>{review.improvement}</p><div className="callout"><strong>Suggested practice</strong><p>Finding the right cart · Product recommendation</p></div></section></div>
    <div className="coach-review-actions"><Link className="btn btn-ghost" href="/coach">Return to Sales Coach</Link><Link className="btn btn-primary" href="/coach/session?scenario=product-fit">Start recommended exercise <ArrowRight size={16}/></Link></div>
  </AppShell>;
}
