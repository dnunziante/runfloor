"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, LoaderCircle } from "lucide-react";
import { createProductFamily } from "@/app/admin/products/actions";

export function RvCatalogCreator() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function createCatalog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const result = await createProductFamily(name);
    if (result.error) setMessage({ type: "error", text: result.error });
    else {
      setName("");
      setMessage({ type: "success", text: result.success });
      router.refresh();
    }
    setSaving(false);
  }

  return <section className="card rv-catalog-creator" id="create-catalog">
    <div><FolderPlus/><span><h2>Create a Catalog</h2><p>Organize RV models into a new workspace catalog.</p></span></div>
    <form onSubmit={createCatalog}>
      <label className="visually-hidden" htmlFor="new-rv-catalog">New catalog name</label>
      <input className="input" id="new-rv-catalog" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter catalog name" maxLength={120} required minLength={2}/>
      <button className="btn btn-primary" disabled={saving || name.trim().length < 2}>{saving ? <><LoaderCircle className="spin" size={16}/> Creating…</> : <><FolderPlus size={16}/> Create Catalog</>}</button>
    </form>
    {message ? <p className={message.type === "error" ? "form-error" : "form-success"} role={message.type === "error" ? "alert" : "status"}>{message.text}</p> : null}
  </section>;
}
