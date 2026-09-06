"use client";
import { useState } from "react";
import type { Editor } from "@tiptap/react";
import styles from "./procedure-document.module.css";
export function ProcedureFormattingToolbar({ editor, busy = false, setError }: { editor: Editor; busy?: boolean; setError: (message: string) => void }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  return <><div className={styles.toolbar} role="toolbar" aria-label="Procedure formatting"><select aria-label="Text style" defaultValue="paragraph" disabled={busy} onChange={event => { const value = Number(event.target.value); if (value) editor.chain().focus().setHeading({ level: value as 1 | 2 | 3 }).run(); else editor.chain().focus().setParagraph().run(); }}><option value="paragraph">Paragraph</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select>{[
          { label: "Bold", action: () => editor.chain().focus().toggleBold().run() },
          { label: "Italic", action: () => editor.chain().focus().toggleItalic().run() },
          { label: "Bullets", action: () => editor.chain().focus().toggleBulletList().run() },
          { label: "Numbered list", action: () => editor.chain().focus().toggleOrderedList().run() },
          { label: "Checklist", action: () => editor.chain().focus().toggleTaskList().run() },
          { label: "Quote", action: () => editor.chain().focus().toggleBlockquote().run() },
          { label: "Link", action: () => { setLinkOpen(!linkOpen); setLinkUrl(editor.getAttributes("link").href || ""); } },
          { label: "Table", action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
          { label: "Add row", action: () => editor.chain().focus().addRowAfter().run() },
          { label: "Add column", action: () => editor.chain().focus().addColumnAfter().run() },
          { label: "Undo", action: () => editor.chain().focus().undo().run() },
          { label: "Redo", action: () => editor.chain().focus().redo().run() },
        ].map(({ label, action }) => <button type="button" key={label} disabled={busy} onClick={action}>{label}</button>)}</div>{linkOpen && <div className={styles.linkForm}><label>Link URL<input className="input" value={linkUrl} placeholder="https://…" onChange={event => setLinkUrl(event.target.value)} /></label><button type="button" className="btn btn-secondary" onClick={() => { if (!/^(https?:\/\/|mailto:|\/[^/]|#)/i.test(linkUrl)) { setError("Enter a valid http, https, or email link."); return; } editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run(); setLinkOpen(false); setError(""); }}>Apply link</button><button type="button" className="btn btn-ghost" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}>Remove link</button></div>}</>;
}