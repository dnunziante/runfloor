"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { saveProductFamilyImage } from "@/app/admin/products/actions";
import { createClient } from "@/lib/supabase/client";
import type { ProductFamilyDTO } from "@/lib/products/types";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ProductFamilyImageManager({ families, organizationId, competitor = false }: { families: ProductFamilyDTO[]; organizationId: string; competitor?: boolean }) {
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ familyId: string; error?: string; success?: string } | null>(null);

  async function upload(family: ProductFamilyDTO, file?: File) {
    if (!file) return;
    if (!allowedTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage({ familyId: family.id, error: "Choose a JPG, PNG, or WebP image no larger than 5 MB." });
      return;
    }
    setSavingId(family.id);
    setMessage(null);
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${organizationId}/families/${family.id}/${crypto.randomUUID()}.${extension}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setMessage({ familyId: family.id, error: `The image could not be uploaded: ${error.message}` });
      setSavingId(null);
      return;
    }
    const result = await saveProductFamilyImage(family.id, path);
    if (result.error) await supabase.storage.from("product-images").remove([path]);
    setMessage({ familyId: family.id, error: result.error || undefined, success: result.success || undefined });
    setSavingId(null);
  }

  return <section className="card form-stack">
    <div><h2>{competitor ? "Competitor brand families" : "Product family images"}</h2><p style={{fontSize:12,marginBottom:0}}>{competitor ? "Each brand houses its models and configurations. Upload a brand cover and open it to manage products." : "Upload the cover shown on the main Product Library. Images are centered and cropped to fit automatically."}</p></div>
    <div className="admin-family-grid">{families.map((family) => <div className="admin-family-card" key={family.id}>
      <div className={`admin-family-image ${family.imageUrl ? "has-image" : ""}`} style={family.imageUrl ? { backgroundImage: `url(${family.imageUrl})` } : undefined}>{!family.imageUrl && <ImagePlus size={28}/>}</div>
      <strong>{family.name}</strong>
      {competitor && <Link className="btn btn-secondary" href={`/admin/competitors?family=${family.id}`}>View models and configurations</Link>}<small>{family.productCount} configuration{family.productCount === 1 ? "" : "s"}</small>
      <input className="visually-hidden" ref={(element) => { inputs.current[family.id] = element; }} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(family, event.target.files?.[0]); event.target.value = ""; }}/>
      <button className="btn btn-ghost" type="button" disabled={savingId === family.id} onClick={() => inputs.current[family.id]?.click()}>{savingId === family.id ? <><LoaderCircle className="spin" size={15}/> Uploading…</> : <><ImagePlus size={15}/>{family.imageUrl ? "Replace image" : "Upload image"}</>}</button>
      {message?.familyId === family.id && message.error && <small className="form-error" role="alert">{message.error}</small>}
      {message?.familyId === family.id && message.success && <small className="form-success" role="status">{message.success}</small>}
    </div>)}</div>
  </section>;
}
