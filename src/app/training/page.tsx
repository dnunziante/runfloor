import { Award, BookOpen, Clock } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { TailoredTrainingBrowser } from "@/components/tailored-training-browser";
import { TrainingBrowser } from "@/components/training-browser";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getCompletedTrainingLessonIds, getTrainingModules } from "@/lib/training/data";
import styles from "./training.module.css";

export default async function Training() {
  const viewer = await getViewer();
  const canReview = Boolean(viewer?.organizationId && ["manager", "tenant_admin", "platform_owner"].includes(viewer.role));
  const canManageModules = Boolean(viewer?.organizationId && ["tenant_admin", "platform_owner"].includes(viewer.role));
  const [result, completedLessonIds, templateKey] = await Promise.all([
    getTrainingModules({ includeDraftLessons: canReview }),
    getCompletedTrainingLessonIds(),
    viewer ? getViewerIndustryTemplateKey(viewer) : Promise.resolve(null),
  ]);
  const publishedLessons = result.lessons.filter((lesson) => lesson.isPublished);
  const totalMinutes = publishedLessons.reduce((total, lesson) => total + lesson.estimatedMinutes, 0);
  const workspaceName = viewer?.organizationName ?? "your workspace";
  const normalizedWorkspace = workspaceName.trim().toLowerCase();
  const tailored = Boolean(viewer && (templateKey === "golf-cart" || viewer.demo || normalizedWorkspace === "runfloor demo" || normalizedWorkspace === "rayne rv"));
  const isRv = templateKey === "rv" || normalizedWorkspace === "rayne rv" || (viewer?.demo && normalizedWorkspace === "runfloor rv");

  if (tailored) return <AppShell title="Training" industry={isRv ? "rv" : undefined}>
    <main className={styles.trainingExperience}>
      <section className={styles.hero}><span className={styles.eyebrow}>Learning center</span><h1>Small lessons.<br/><em>Stronger conversations.</em></h1><p>Build practical product and sales skills from approved {workspaceName} knowledge.</p></section>
      <div className={styles.content}>
        <section className={styles.metrics} aria-label="Training overview">
          <article><span className={styles.metricIcon}><BookOpen size={25}/></span><div><small>Knowledge-based lessons</small><strong>{publishedLessons.length}</strong><p>Published and available</p></div></article>
          <article><span className={`${styles.metricIcon} ${styles.blue}`}><Clock size={25}/></span><div><small>Assigned learning time</small><strong>{totalMinutes}m</strong><p>Time spent learning</p></div></article>
          <article><span className={`${styles.metricIcon} ${styles.green}`}><Award size={25}/></span><div><small>Team</small><strong className={styles.teamName}>{workspaceName}</strong><p>Your training library</p></div></article>
        </section>
        {result.error
          ? <div className="card error-card"><h2>Training unavailable</h2><p>{result.error}</p></div>
          : <TailoredTrainingBrowser lessons={publishedLessons} modules={result.modules} completedLessonIds={completedLessonIds} canReview={canReview} canManageModules={canManageModules}/>
        }
        <section className={styles.benefits} aria-label="Training benefits">
          <div><Award/><span><strong>Build Product Expertise</strong><small>Learn key features and benefits to sell with confidence.</small></span></div>
          <div><BookOpen/><span><strong>Improve Sales Conversations</strong><small>Practice real scenarios and overcome common objections.</small></span></div>
          <div><Clock/><span><strong>Onboard Faster</strong><small>Get new team members up to speed with proven resources.</small></span></div>
          <div><Award/><span><strong>Stronger Dealership Results</strong><small>Better knowledge. Happier customers.</small></span></div>
        </section>
      </div>
    </main>
  </AppShell>;

  return <AppShell title="Training">
    <PageHeader eyebrow="Learning center" title="Small lessons. Stronger conversations." description={`Build practical product and sales skills from approved ${workspaceName} knowledge.`} action={canReview ? <div className="training-page-actions"><Link className="btn btn-secondary" href="/training/review">Review lessons</Link>{canManageModules && <Link className="btn btn-primary" href="/admin/training">Manage modules</Link>}</div> : null}/>
    <div className="grid grid-3"><div className="card"><div className="metric-icon"><BookOpen size={19}/></div><div className="metric">{publishedLessons.length}</div><p>Knowledge-based lessons</p></div><div className="card"><div className="metric-icon"><Clock size={19}/></div><div className="metric">{totalMinutes}m</div><p>Assigned learning time</p></div><div className="card"><div className="metric-icon"><Award size={19}/></div><div className="metric">{viewer?.demo ? "RV" : "Team"}</div><p>{workspaceName} training</p></div></div>
    {result.error ? <div className="card error-card"><h2>Training unavailable</h2><p>{result.error}</p></div> : publishedLessons.length || result.modules.length ? <TrainingBrowser lessons={publishedLessons} modules={result.modules} completedLessonIds={completedLessonIds} canReview={canReview} workspaceName={workspaceName}/> : <div className="card output empty"><div><h2>No knowledge-based lessons yet</h2><p>Upload a document in Knowledge Base and keep “Create Training Lesson” selected, then publish the reviewed draft.</p></div></div>}
  </AppShell>;
}
