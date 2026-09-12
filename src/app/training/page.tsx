import { Award, BookOpen, Clock } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { TrainingBrowser } from "@/components/training-browser";
import { getViewer } from "@/lib/auth/viewer";
import { getCompletedTrainingLessonIds, getTrainingModules } from "@/lib/training/data";

export default async function Training() {
  const viewer = await getViewer();
  const canReview = Boolean(viewer?.organizationId && ["manager", "tenant_admin", "platform_owner"].includes(viewer.role));
  const canManageModules = Boolean(viewer?.organizationId && ["tenant_admin", "platform_owner"].includes(viewer.role));
  const [result, completedLessonIds] = await Promise.all([getTrainingModules({ includeDraftLessons: canReview }), getCompletedTrainingLessonIds()]);
  const publishedLessons = result.lessons.filter((lesson) => lesson.isPublished);
  const totalMinutes = publishedLessons.reduce((total, lesson) => total + lesson.estimatedMinutes, 0);
  const workspaceName = viewer?.organizationName ?? "your workspace";

  return <AppShell title="Training">
    <PageHeader eyebrow="Learning center" title="Small lessons. Stronger conversations." description={`Build practical product and sales skills from approved ${workspaceName} knowledge.`} action={canReview ? <div className="training-page-actions"><Link className="btn btn-secondary" href="/training/review">Review lessons</Link>{canManageModules && <Link className="btn btn-primary" href="/admin/training">Manage modules</Link>}</div> : null}/>
    <div className="grid grid-3">
      <div className="card"><div className="metric-icon"><BookOpen size={19}/></div><div className="metric">{publishedLessons.length}</div><p>Knowledge-based lessons</p></div>
      <div className="card"><div className="metric-icon"><Clock size={19}/></div><div className="metric">{totalMinutes}m</div><p>Assigned learning time</p></div>
      <div className="card"><div className="metric-icon"><Award size={19}/></div><div className="metric">{viewer?.demo ? "RV" : "Team"}</div><p>{workspaceName} training</p></div>
    </div>

    {result.error ? <div className="card error-card"><h2>Training unavailable</h2><p>{result.error}</p></div> : publishedLessons.length || result.modules.length ? <TrainingBrowser lessons={publishedLessons} modules={result.modules} completedLessonIds={completedLessonIds} canReview={canReview} workspaceName={workspaceName}/> : <div className="card output empty"><div><h2>No knowledge-based lessons yet</h2><p>Upload a document in Knowledge Base and keep “Create Training Lesson” selected, then publish the reviewed draft.</p></div></div>}
  </AppShell>;
}
