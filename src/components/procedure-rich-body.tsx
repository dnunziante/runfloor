"use client";
import { useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { procedureExtensions } from "@/lib/procedures/extensions";
import { ProcedureFormattingToolbar } from "./procedure-formatting-toolbar";
import styles from "./procedure-document.module.css";

export function ProcedureRichBody({ document, editable = false, onChange }: { document: JSONContent; editable?: boolean; onChange?: (document: JSONContent) => void }) {
  const [error, setError] = useState("");
  const editor = useEditor({ extensions: procedureExtensions(), content: document, editable, immediatelyRender: false, editorProps: { attributes: { "aria-label": "Complete procedure body", class: styles.prose } }, onUpdate: ({ editor }) => onChange?.(JSON.parse(JSON.stringify(editor.getJSON())) as JSONContent) });
  return <div>{editable && editor && <ProcedureFormattingToolbar editor={editor} setError={setError} />}{error && <p role="alert" className="form-error">{error}</p>}<EditorContent editor={editor} />{!editor && <p>Loading complete procedure…</p>}</div>;
}
