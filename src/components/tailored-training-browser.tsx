"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, BriefcaseBusiness, CheckCircle2, Clock, FileText, PlayCircle, Plus, Search, Settings, Tag, Users } from "lucide-react";
import { toDisplayTrainingCategory } from "@/lib/training/categories";
import type { TrainingLessonDTO, TrainingModuleDTO } from "@/lib/training/types";
import styles from "@/app/training/training.module.css";

const tabs = [["all", "All Lessons", BookOpen], ["mine", "My Learning", Users], ["product", "Product Knowledge", Tag], ["sales", "Sales Skills", BriefcaseBusiness], ["operations", "Dealership Operations", Settings]] as const;

export function TailoredTrainingBrowser({ lessons, modules, completedLessonIds, canReview, canManageModules }: { lessons: TrainingLessonDTO[]; modules: TrainingModuleDTO[]; completedLessonIds: string[]; canReview: boolean; canManageModules: boolean }) {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("all");
  const [query, setQuery] = useState("");
  const visibleLessons = useMemo(() => lessons.filter((lesson) => {
    const category = toDisplayTrainingCategory(lesson.collection).toLowerCase();
    const categoryMatches = tab === "all" || (tab === "mine" && !completedLessonIds.includes(lesson.id)) || (tab === "product" && category.includes("product")) || (tab === "sales" && category.includes("sales")) || (tab === "operations" && category.includes("operation"));
    return categoryMatches && `${lesson.title} ${lesson.description} ${lesson.collection}`.toLowerCase().includes(query.toLowerCase());
  }), [completedLessonIds, lessons, query, tab]);

  return <section className={styles.library}>
    <div className={styles.controls}>
      <div className={styles.tabs} role="tablist" aria-label="Training lesson filters">{tabs.map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={16}/>{label}</button>)}</div>
      <label className={styles.search}><Search size={16}/><span className="sr-only">Search lessons</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lessons..."/></label>
      {canManageModules ? <Link className="btn btn-primary" href="/admin/training"><Plus size={16}/> Create lesson</Link> : canReview ? <Link className="btn btn-primary" href="/training/review">Review lessons</Link> : null}
    </div>
    {visibleLessons.length ? <div className={styles.lessonGrid}>{visibleLessons.map((lesson) => <Link href={`/training/${lesson.id}`} key={lesson.id} className={styles.lessonCard}><span className={styles.lessonIcon}><FileText/></span><span className="badge blue">{toDisplayTrainingCategory(lesson.collection)}</span><h2>{lesson.title}</h2><p>{lesson.description}</p><small><Clock size={13}/>{lesson.estimatedMinutes} min · {lesson.sourceFilename}</small><span className="btn btn-primary">{completedLessonIds.includes(lesson.id) ? <><CheckCircle2 size={15}/> Completed</> : <><PlayCircle size={15}/> Open lesson</>}</span></Link>)}</div> : <div className={styles.empty}><BookOpen size={70}/><h2>{lessons.length ? "No lessons match this view" : "No knowledge-based lessons yet"}</h2><p>{lessons.length ? "Try another category or clear your search." : "Upload a document in Knowledge Base and keep “Create Training Lesson” selected, then publish the reviewed draft."}</p>{canManageModules ? <Link className="btn btn-primary" href="/admin/training"><BookOpen size={17}/> Create your first lesson</Link> : canReview ? <Link className="btn btn-primary" href="/training/review">Review lesson drafts</Link> : null}{modules.length === 0 && <Link className="text-button" href="/knowledge-base">Learn more about creating lessons</Link>}</div>}
  </section>;
}
