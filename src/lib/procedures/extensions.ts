import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";

export function procedureExtensions() {
  return [StarterKit.configure({ trailingNode: false, link: { openOnClick: true, autolink: true, protocols: ["http", "https", "mailto"], HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } } }), TaskList, TaskItem.configure({ nested: true }), TableKit.configure({ table: { resizable: false } })];
}
