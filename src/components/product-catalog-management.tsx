"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, PackagePlus, Pencil, Trash2 } from "lucide-react";
import { createProductCatalog, deleteProductCatalog, updateProductCatalog } from "@/app/admin/products/actions";
import { createClient } from "@/lib/supabase/client";
import { saveProductFamilyImage } from "@/app/admin/products/actions";
import type { ProductFamilyDTO } from "@/lib/products/types";

type Message = { error: string; success: string };
const emptyMessage: Message = { error: "", success: "" };

export function ProductLibraryActions({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<Message>(emptyMessage);
  const [saving, setSaving] = useState(false);

  async function createCatalog(form: HTMLFormElement) {
    setSaving(true); setMessage(emptyMessage);
    const data = new FormData(form);
    const result = await createProductCatalog(String(data.get("name") || ""), String(data.get("description") || ""));
    if (result.error || !result.catalogId) { setMessage(result); setSaving(false); return; }
    const image = data.get("image");
    if (image instanceof File && image.size) {
      if (!/^image\/(jpeg|png|webp)$/.test(image.type) || image.size > 5 * 1024 * 1024) { setMessage({ error: "Catalog created, but the image must be a JPG, PNG, or WebP no larger than 5 MB.", success: result.success }); setSaving(false); return; }
      const extension = image.type === "image/jpeg" ? "jpg" : image.type.split("/")[1];
      const path = `${organizationId}/families/${result.catalogId}/${crypto.randomUUID()}.${extension}`;
      const storage = createClient();
      const { error } = await storage.storage.from("product-images").upload(path, image, { contentType: image.type, upsert: false });
      if (error) { setMessage({ error: `Catalog created, but its image could not be uploaded: ${error.message}`, success: result.success }); setSaving(false); return; }
      const imageResult = await saveProductFamilyImage(result.catalogId, path);
      if (imageResult.error) { await storage.storage.from("product-images").remove([path]); setMessage({ error: imageResult.error, success: result.success }); setSaving(false); return; }
    }
    form.reset(); setOpen(false); setMessage(result); setSaving(false);
  }

  return <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
    <Link className="btn btn-primary" href="/admin/products?create=1"><PackagePlus size={16}/> Add Product</Link>
    <button className="btn btn-secondary" type="button" onClick={() => setOpen((current) => !current)}><FolderPlus size={16}/> Create Catalog</button>
    {open && <form className="card form-stack" style={{ width: "min(100%, 420px)", position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 5, textAlign: "left" }} onSubmit={(event) => { event.preventDefault(); void createCatalog(event.currentTarget); }}>
      <div><h2>Create catalog</h2><p>Catalogs stay inside this dealership workspace.</p></div>
      <label><span className="label">Catalog Name</span><input className="input" name="name" required minLength={2} maxLength={120} placeholder="Forest River"/></label>
      <label><span className="label">Description</span><textarea className="input" name="description" maxLength={500} rows={3} placeholder="Current Forest River models and configurations."/></label>
      <label><span className="label">Catalog Image <span className="optional-label">Optional</span></span><input className="input" name="image" type="file" accept="image/jpeg,image/png,image/webp"/></label>
      {message.error && <p className="form-error" role="alert">{message.error}</p>}{message.success && <p className="form-success" role="status">{message.success}</p>}
      <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary" disabled={saving}>{saving ? "Creating…" : "Create Catalog"}</button><button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>}
  </div>;
}

export function CatalogManagementActions({ catalog, catalogs }: { catalog: ProductFamilyDTO; catalogs: ProductFamilyDTO[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false); const [deleting, setDeleting] = useState(false); const [message, setMessage] = useState<Message>(emptyMessage); const [saving, setSaving] = useState(false);
  const targets = catalogs.filter((item) => item.id !== catalog.id);
  async function save(form: HTMLFormElement) { setSaving(true); const data = new FormData(form); const result = await updateProductCatalog(catalog.id, String(data.get("name") || ""), String(data.get("description") || "")); setMessage(result); setSaving(false); if (!result.error) setEditing(false); }
  async function remove(form: HTMLFormElement) { setSaving(true); const data = new FormData(form); const result = await deleteProductCatalog(catalog.id, String(data.get("disposition") || "uncategorized") as "uncategorized" | "move" | "archive", String(data.get("targetCatalogId") || "")); setMessage(result); setSaving(false); if (!result.error) router.push("/products"); }
  return <section className="card form-stack"><div className="metric-row"><div><span className="eyebrow">Catalog management</span><h2>Manage {catalog.name}</h2><p>Add a new product, attach existing products in Admin, or update this catalog.</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Link className="btn btn-primary" href={`/admin/products?create=1&family=${catalog.id}`}><PackagePlus size={16}/> Add Product</Link><Link className="btn btn-secondary" href={`/admin/products?family=${catalog.id}`}>Add Existing Products</Link><button className="btn btn-ghost" type="button" onClick={() => setEditing((value) => !value)}><Pencil size={16}/> Edit Catalog</button><button className="btn btn-ghost danger-button" type="button" onClick={() => setDeleting((value) => !value)}><Trash2 size={16}/> Delete Catalog</button></div></div>
    {editing && <form className="grid grid-2" onSubmit={(event) => { event.preventDefault(); void save(event.currentTarget); }}><label><span className="label">Catalog Name</span><input className="input" name="name" defaultValue={catalog.name} required minLength={2} maxLength={120}/></label><label><span className="label">Description</span><input className="input" name="description" defaultValue={catalog.description} maxLength={500}/></label><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Catalog"}</button></form>}
    {deleting && <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void remove(event.currentTarget); }}><p><strong>Deleting this catalog will not delete its products.</strong> Choose what should happen to them.</p><label><span className="label">After deletion</span><select className="input" name="disposition" defaultValue="uncategorized"><option value="uncategorized">Leave products uncategorized</option><option value="move" disabled={!targets.length}>Move products to another catalog</option><option value="archive">Archive products</option></select></label>{targets.length > 0 && <label><span className="label">Destination Catalog <span className="optional-label">Required only when moving</span></span><select className="input" name="targetCatalogId" defaultValue=""><option value="">Choose a catalog</option>{targets.map((target) => <option value={target.id} key={target.id}>{target.name}</option>)}</select></label>}<div style={{ display: "flex", gap: 8 }}><button className="btn danger-button" disabled={saving}>{saving ? "Deleting…" : "Delete Catalog"}</button><button className="btn btn-ghost" type="button" onClick={() => setDeleting(false)}>Cancel</button></div></form>}
    {message.error && <p className="form-error" role="alert">{message.error}</p>}{message.success && <p className="form-success" role="status">{message.success}</p>}
  </section>;
}
