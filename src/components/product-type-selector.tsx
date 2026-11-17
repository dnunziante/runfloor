"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { saveProductType, type ProductTypeState } from "@/app/admin/products/product-type-actions";
import type { ProductType } from "@/lib/products/types";
import styles from "./product-type-selector.module.css";

export function ProductTypeSelector({ productId, productType = "our_product", readOnly = false }: { productId: string; productType?: ProductType; readOnly?: boolean }) {
  const [selected, setSelected] = useState(productType);
  const [state, action, pending] = useActionState(saveProductType, { error: "", success: "" } as ProductTypeState);
  const saved = state.productType ?? productType;
  const dirty = selected !== saved;
  return <form className={`card ${styles.form}`} action={action} aria-label="Change product type">
    <input type="hidden" name="productId" value={productId}/>
    <div className={styles.row}>
      <label className={styles.field}><span className="label">Product type</span><select className="input" name="productType" value={selected} onChange={event => setSelected(event.target.value as ProductType)} disabled={readOnly || pending}><option value="our_product">My product</option><option value="competitor_product">Competitor product</option></select></label>
      <button className="btn btn-primary" disabled={readOnly || pending || !dirty} type="submit">{pending ? <LoaderCircle className="spin" size={16}/> : <Save size={16}/>} {pending ? "Saving…" : "Save product type"}</button>
    </div>
    <div className={styles.status} aria-live="polite">{state.error ? <p className="form-error" role="alert">{state.error}</p> : dirty ? <p>Unsaved change · Move to {selected === "our_product" ? "My Products" : "Competitor Products"}.</p> : <p className={state.success ? "form-success" : ""}>{state.success || `Current location: ${saved === "our_product" ? "My Products" : "Competitor Products"}`}</p>}</div>
    {readOnly && <p className="demo-note">Sign in with product management access to save changes.</p>}
  </form>;
}
