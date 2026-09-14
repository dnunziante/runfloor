"use client";

import { useEffect, useState } from "react";
import { FolderInput } from "lucide-react";
import { useFormStatus } from "react-dom";
import { setProductsCatalog } from "@/app/admin/products/actions";
import type { ProductFamilyDTO } from "@/lib/products/types";

const formId = "rv-bulk-catalog-form";

function SubmitBulkButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary" disabled={!count || pending}><FolderInput size={16}/>{pending ? "Adding…" : `Add ${count || "selected"} to Catalog`}</button>;
}

export function RvBulkCatalogToolbar({ catalogs, productIds }: { catalogs: ProductFamilyDTO[]; productIds: string[] }) {
  const [count, setCount] = useState(0);
  const [allSelected, setAllSelected] = useState(false);

  useEffect(() => {
    const update = () => {
      const checked = document.querySelectorAll<HTMLInputElement>(`input[form="${formId}"][name="productIds"]:checked`).length;
      setCount(checked);
      setAllSelected(productIds.length > 0 && checked === productIds.length);
    };
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, [productIds]);

  function toggleAll() {
    const next = !allSelected;
    document.querySelectorAll<HTMLInputElement>(`input[form="${formId}"][name="productIds"]`).forEach((input) => { input.checked = next; });
    setCount(next ? productIds.length : 0);
    setAllSelected(next);
  }

  return <form className="rv-bulk-catalog-toolbar" id={formId} action={setProductsCatalog}>
    <button className="btn btn-ghost" type="button" onClick={toggleAll}>{allSelected ? "Clear selection" : "Select all shown"}</button>
    <strong>{count} selected</strong>
    <label><span className="visually-hidden">Catalog for selected products</span><select className="input" name="familyId" required defaultValue=""><option value="" disabled>Choose a catalog</option>{catalogs.map((catalog) => <option value={catalog.id} key={catalog.id}>{catalog.name}</option>)}</select></label>
    <SubmitBulkButton count={count}/>
  </form>;
}
