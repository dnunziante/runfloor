"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./procedure-workspace.module.css";

export function ProcedureOverlay({ title, onClose, children, drawer = false }: { title: string; onClose: () => void; children: ReactNode; drawer?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; const previous = document.activeElement as HTMLElement | null; element?.showModal(); const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); }; }, []);
  return <dialog ref={dialog} className={`${styles.overlay} ${drawer ? styles.drawer : ""}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className={styles.overlayInner}><header className={styles.overlayHeader}><div><span className={styles.eyebrow}>RUNFLOOR PROCEDURES</span><h2>{title}</h2></div><button type="button" className="btn btn-ghost" aria-label="Close procedure panel" onClick={onClose}><X size={20} /></button></header><div className={styles.overlayBody}>{children}</div></div></dialog>;
}
