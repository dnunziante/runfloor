export type LibraryScope = "platform" | "tenant";
export type LibraryCategory = {
  id: string; name: string; description: string; style_name: string; sort_order: number;
  archived_at: string | null; archived_by: string | null;
};
export type LibraryProcedure = {
  id: string; title: string; category: string; category_id?: string;
  archived_at: string | null; archived_by: string | null; original_category: string | null;
};
export type LibrarySnapshot = {
  categories: LibraryCategory[]; procedures: LibraryProcedure[];
  people: Record<string, string>; error?: string; pendingMigration?: boolean;
};
export type LibraryCommand = {
  action: "category_create" | "category_update" | "category_reorder" | "category_archive" | "category_restore" | "category_delete"
    | "procedure_archive" | "procedure_restore" | "procedure_move" | "procedure_duplicate" | "procedure_delete";
  id?: string;
  name?: string; description?: string; direction?: "up" | "down";
  destination?: string; disposition?: "move" | "uncategorized" | "archive" | "delete"; confirmed?: boolean;
};
export const emptyLibrary: LibrarySnapshot = { categories: [], procedures: [], people: {} };
export function categoryProcedures(snapshot: LibrarySnapshot, category: LibraryCategory) {
  return snapshot.procedures.filter(item => item.category_id ? item.category_id === category.id : item.category === category.name);
}
