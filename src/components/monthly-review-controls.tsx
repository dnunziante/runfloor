"use client";

import { ArrowRight, CheckCircle2, Printer, Save, StickyNote, Target } from "lucide-react";
import { useActionState, useState } from "react";
import { completeMonthlyLeadershipReview, type ReviewCompletionState } from "@/app/executive/review/actions";
import styles from "@/app/executive/review/review.module.css";

export function MonthlyReviewControls({ period, initial }: { period: string; initial: ReviewCompletionState }) {
  const [state, action, pending] = useActionState(completeMonthlyLeadershipReview, initial);
  const [notes, setNotes] = useState(initial.notes);
  return <form className={styles.reviewForm} action={action}>
    <input type="hidden" name="period" value={period}/>
    <article className={styles.panel}><div className={styles.panelHead}><span className={styles.panelIcon}><StickyNote size={24}/></span><div><h2>Review Notes</h2><p>Capture discussion points, agreements, and follow-ups.</p></div></div><label className="sr-only" htmlFor="monthly-review-notes">Review notes</label><textarea id="monthly-review-notes" name="notes" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Write your review notes here…"/><div className={styles.noteTools}><span>{notes.length} / 2000 characters</span><button type="button" onClick={() => setNotes("")}>Clear</button></div>{state.error && <p className="form-error" role="alert">{state.error}</p>}<button className={styles.saveButton} type="submit" disabled={pending}><Save size={16}/>{pending ? "Saving…" : "Save notes and complete review"}</button></article>
    <footer className={styles.completion}><Target size={44}/><div><h2>{state.completedAt ? "Review completed" : "Close the loop. Turn insights into action."}</h2><p>{state.completedAt ? `Completed by ${state.completedBy} on ${new Date(state.completedAt).toLocaleString()}.` : "Complete this review, record key decisions, and keep your leadership team aligned."}</p></div><button type="button" className={styles.printButton} onClick={() => window.print()}><Printer size={16}/>Print</button><button type="submit" disabled={pending}><CheckCircle2 size={17}/>{pending ? "Saving…" : state.completedAt ? "Update completion" : "Mark review complete"}<ArrowRight size={17}/></button></footer>
  </form>;
}
