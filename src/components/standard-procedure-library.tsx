import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activeProcedureRows, isProcedureLibraryReady } from "@/lib/procedures/library-availability";
import { defaultOperationsProcedureCategories } from "@/lib/operations/data";
import styles from "./standard-procedure-library.module.css";

export async function StandardProcedureLibrary() {
  const client = await createClient();
  const { data, error } = await activeProcedureRows(client.from("platform_procedure_templates")
    .select("id,title,category").eq("is_standard", true).eq("is_published", true).order("category").order("title"),
  await isProcedureLibraryReady("platform"));
  if (error) return <section className="card" aria-label="Standard procedures"><h2>Standard procedures</h2><p role="alert">The standard procedure library could not be loaded. Please reload to try again.</p></section>;
  const procedures = data ?? [];
  const categoryOrder = new Map(defaultOperationsProcedureCategories.map((item, index) => [item.name, index]));
  const categories = [...new Set(procedures.map(item => item.category))].sort((left, right) => (categoryOrder.get(left) ?? 1000) - (categoryOrder.get(right) ?? 1000) || left.localeCompare(right));
  return <section className={`card ${styles.library}`} aria-label="Standard procedures">
    <header><div><span className={styles.eyebrow}>INCLUDED WITH EVERY INDUSTRY TEMPLATE</span><h2>Standard procedures</h2><p>{procedures.length} procedures across {categories.length} categories. New tenants receive their own editable copies.</p></div><Link className="btn btn-secondary" href="/admin/platform#procedure-library-heading">Manage procedure library</Link></header>
    <div className={styles.categories}>{categories.map(category => {
      const items = procedures.filter(item => item.category === category);
      return <details key={category}><summary>{category}<span>{items.length}</span></summary><ul>{items.map(item => <li key={item.id}><Link href={`/admin/platform/procedures/${item.id}`}>{item.title}</Link></li>)}</ul></details>;
    })}</div>
    <p className={styles.note}>Tenant copies stay independent. Editing a standard procedure does not overwrite a tenant’s existing changes.</p>
  </section>;
}
