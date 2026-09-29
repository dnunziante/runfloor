"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Bookmark, BriefcaseBusiness, CheckCircle2, Clock, PlayCircle, Plus, Search, Settings, Sparkles, Star, Tag } from "lucide-react";
import { toDisplayTrainingCategory } from "@/lib/training/categories";
import type { TrainingLessonDTO, TrainingModuleDTO } from "@/lib/training/types";
import styles from "@/app/training/training.module.css";

const tabs = [["all", "All Lessons", BookOpen], ["product", "Product Knowledge", Tag], ["sales", "Sales Skills", BriefcaseBusiness], ["operations", "Dealership Operations", Settings], ["service", "Service & Parts", Settings], ["customer", "Customer Experience", Sparkles]] as const;

export function TailoredTrainingBrowser({ lessons, modules, completedLessonIds, canReview, canManageModules, workspaceName = "your workspace", golfCart = false }: { lessons: TrainingLessonDTO[]; modules: TrainingModuleDTO[]; completedLessonIds: string[]; canReview: boolean; canManageModules: boolean; workspaceName?: string; golfCart?: boolean }) {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("all");
  const [query, setQuery] = useState("");
  const visibleLessons = useMemo(() => lessons.filter((lesson) => {
    const category = toDisplayTrainingCategory(lesson.collection).toLowerCase();
    const haystack = `${category} ${lesson.collection} ${lesson.title} ${lesson.description}`.toLowerCase();
    const categoryMatches = tab === "all" || (tab === "product" && category.includes("product")) || (tab === "sales" && category.includes("sales")) || (tab === "operations" && category.includes("operation")) || (tab === "service" && /service|parts|maintenance/.test(haystack)) || (tab === "customer" && /customer|experience|policy|general/.test(haystack));
    return categoryMatches && `${lesson.title} ${lesson.description} ${lesson.collection}`.toLowerCase().includes(query.toLowerCase());
  }), [completedLessonIds, lessons, query, tab]);

  const completionRate = lessons.length ? Math.round((completedLessonIds.length / lessons.length) * 100) : 0;
  const recommended = lessons.find((lesson) => !completedLessonIds.includes(lesson.id)) ?? lessons[0];
  const completedLessons = lessons.filter((lesson) => completedLessonIds.includes(lesson.id));

  return <section className={`${styles.library} ${golfCart ? styles.golfCartLibrary : ""}`}>
    <div className={styles.controls}>
      <div className={styles.tabs} role="tablist" aria-label="Training lesson filters">{tabs.map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={16}/>{label}</button>)}</div>
      <label className={styles.search}><Search size={16}/><span className="sr-only">Search lessons</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lessons, topics, or keywords..."/></label>
      {canManageModules ? <Link className="btn btn-primary" href="/admin/training"><Plus size={16}/> Create lesson</Link> : canReview ? <Link className="btn btn-primary" href="/training/review">Review lessons</Link> : null}
    </div>
    {visibleLessons.length ? <section className={styles.featured}><header><div><h2>Featured Training</h2><p>Start with these high-impact lessons to sharpen your skills and boost your results.</p></div><Link href="/training">View all <ArrowRight/></Link></header><div className={styles.lessonGrid}>{visibleLessons.slice(0, 4).map((lesson, index) => <article key={lesson.id} className={styles.lessonCard}><Link href={`/training/${lesson.id}`} className={`${styles.lessonImage} ${styles[`lessonImage${index % 4}`]}`} aria-label={`Open ${lesson.title}`}><span><Clock size={12}/>{lesson.estimatedMinutes} min</span></Link><div className={styles.lessonBody}><span className={styles.category}>{toDisplayTrainingCategory(lesson.collection)}</span><h2><Link href={`/training/${lesson.id}`}>{lesson.title}</Link></h2><p>{lesson.description}</p><div><Link href={`/training/${lesson.id}`}>{completedLessonIds.includes(lesson.id) ? "Review Lesson" : "Begin Lesson"} <ArrowRight/></Link><Bookmark aria-hidden="true"/></div></div></article>)}</div></section> : <div className={styles.empty}><BookOpen size={70}/><h2>{lessons.length ? "No lessons match this view" : "No knowledge-based lessons yet"}</h2><p>{lessons.length ? "Try another category or clear your search." : "Upload a document in Knowledge Base and keep “Create Training Lesson” selected, then publish the reviewed draft."}</p>{canManageModules ? <Link className="btn btn-primary" href="/admin/training"><BookOpen size={17}/> Create your first lesson</Link> : canReview ? <Link className="btn btn-primary" href="/training/review">Review lesson drafts</Link> : null}{modules.length === 0 && <Link className="text-button" href="/knowledge-base">Learn more about creating lessons</Link>}</div>}
    {golfCart && lessons.length > 0 && <div className={styles.learningSummary}>
      <section><header><div><h2>My Learning Progress</h2><p>Track your progress across the {workspaceName} training library.</p></div><Link href="/coach/development">View details <ArrowRight/></Link></header><div className={styles.progressContent}><div className={styles.progressRing} style={{ "--progress": `${completionRate * 3.6}deg` } as React.CSSProperties}><strong>{completionRate}%</strong><span>Complete</span></div><div className={styles.progressList}>{tabs.slice(1, 5).map(([id, label], index) => { const categoryLessons = lessons.filter((lesson) => { const value = `${lesson.collection} ${lesson.title}`.toLowerCase(); return id === "product" ? value.includes("product") : id === "sales" ? value.includes("sales") : id === "operations" ? value.includes("operation") : /service|parts|maintenance/.test(value); }); const done = categoryLessons.filter((lesson) => completedLessonIds.includes(lesson.id)).length; const percent = categoryLessons.length ? Math.round((done / categoryLessons.length) * 100) : 0; return <div key={id}><span>{label}</span><i><b style={{ width: `${percent}%` }}/></i><strong>{percent}%</strong><em className={styles[`progressColor${index}`]}/></div>; })}</div></div></section>
      <section><header><div><h2>Recent Activity</h2><p>Your latest completed training.</p></div><Link href="/coach/development">View all <ArrowRight/></Link></header><div className={styles.activityList}>{completedLessons.length ? completedLessons.slice(0, 4).map((lesson) => <Link href={`/training/${lesson.id}`} key={lesson.id}><CheckCircle2/><span><strong>Completed: {lesson.title}</strong><small>{lesson.estimatedMinutes} minute lesson</small></span></Link>) : <div className={styles.noActivity}><PlayCircle/><span><strong>Your progress starts here</strong><small>Complete a lesson to build your activity history.</small></span></div>}</div></section>
      {recommended && <section className={styles.recommended}><header><div><h2>Recommended Next</h2><p>Based on your available training.</p></div></header><div className={styles.recommendedCard}><span className={styles.recommendedImage}/><div><span><Star/> Recommended</span><strong>{recommended.title}</strong><small>{toDisplayTrainingCategory(recommended.collection)} · {recommended.estimatedMinutes} min</small><Link href={`/training/${recommended.id}`}>Start Lesson <ArrowRight/></Link></div></div></section>}
    </div>}
  </section>;
}
