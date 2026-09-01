"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Eye, EyeOff, GripVertical, Pencil, Trash2 } from "lucide-react";
import { deleteProduct, duplicateProduct, saveProductOrder, setProductStatus } from "@/app/admin/products/actions";
import type { ProductDTO, ProductFamilyDTO } from "@/lib/products/types";

type Category = ProductFamilyDTO & { products: ProductDTO[] };

export function AdminProductCategoryList({ categories }: { categories: Category[] }) {
  const [items, setItems] = useState(categories);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function persist(familyId: string, products: ProductDTO[]) {
    setMessage("Saving order…");
    startTransition(async () => {
      const result = await saveProductOrder(familyId, products.map((product) => product.id));
      setMessage(result.error || result.success);
    });
  }

  function reorder(familyId: string, fromId: string, toId: string) {
    const category = items.find((item) => item.id === familyId);
    if (!category || fromId === toId) return;
    const fromIndex = category.products.findIndex((product) => product.id === fromId);
    const toIndex = category.products.findIndex((product) => product.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const products = [...category.products];
    const [moved] = products.splice(fromIndex, 1);
    products.splice(toIndex, 0, moved);
    setItems((current) => current.map((item) => item.id === familyId ? { ...item, products } : item));
    persist(familyId, products);
  }

  function move(familyId: string, productId: string, direction: -1 | 1) {
    const category = items.find((item) => item.id === familyId);
    if (!category) return;
    const index = category.products.findIndex((product) => product.id === productId);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= category.products.length) return;
    reorder(familyId, productId, category.products[destination].id);
  }

  return <div className="admin-product-categories">
    <p className="admin-product-order-help">Drag items into the preferred order, or use the arrow buttons. Changes save automatically.</p>
    {message && <p className={message === "Order saved." ? "form-success" : message === "Saving order…" ? "field-help" : "form-error"} role="status">{message}</p>}
    {items.map((family) => <details className="admin-product-category" name="admin-product-category" key={family.id}>
      <summary><span><strong>{family.name}</strong><small>{family.products.length} {family.products.length === 1 ? "item" : "items"}</small></span><ChevronDown className="admin-product-category-chevron" size={18}/></summary>
      {family.products.length ? <div className="table-wrap"><table className="table"><thead><tr><th aria-label="Order"/><th>Name</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{family.products.map((product, index) => <tr
        className={draggedId === product.id ? "is-dragging" : ""}
        draggable={!isPending}
        key={product.id}
        onDragStart={(event) => { setDraggedId(product.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", product.id); }}
        onDragEnd={() => setDraggedId(null)}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
        onDrop={(event) => { event.preventDefault(); const sourceId = event.dataTransfer.getData("text/plain") || draggedId; if (sourceId) reorder(family.id, sourceId, product.id); setDraggedId(null); }}
      >
        <td><div className="product-order-controls"><GripVertical className="product-drag-handle" size={18} aria-hidden="true"/><button type="button" onClick={() => move(family.id, product.id, -1)} disabled={index === 0 || isPending} aria-label={`Move ${product.name} up`}><ArrowUp size={14}/></button><button type="button" onClick={() => move(family.id, product.id, 1)} disabled={index === family.products.length - 1 || isPending} aria-label={`Move ${product.name} down`}><ArrowDown size={14}/></button></div></td>
        <td><div className="admin-product-name">{product.imageUrl ? <span className="admin-product-thumbnail" style={{backgroundImage:`url(${product.imageUrl})`}} role="img" aria-label={`${product.name} thumbnail`}/> : <span className={`admin-product-thumbnail placeholder ${product.color}`} aria-hidden="true"/>}<span><strong>{product.name}</strong><small>{product.model}</small></span></div></td>
        <td>${product.price.toLocaleString()}</td>
        <td><span className={`badge ${product.status === "Draft" ? "amber" : ""}`}>{product.status}</span></td>
        <td><div className="product-row-actions">
          <Link className="btn btn-ghost status-button" href={`/admin/products/${product.id}/edit`}><Pencil size={14}/> Edit</Link>
          <form action={duplicateProduct}><input type="hidden" name="productId" value={product.id}/><button className="btn btn-ghost status-button" type="submit"><Copy size={14}/> Duplicate</button></form>
          <Link className="btn btn-ghost status-button" href={`/admin/products/${product.id}/guide`}>Sales guide</Link>
          <form action={setProductStatus}><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="status" value={product.status === "Published" ? "draft" : "published"}/><button className="btn btn-ghost status-button" type="submit">{product.status === "Published" ? <><EyeOff size={14}/> Move to draft</> : <><Eye size={14}/> Publish</>}</button></form>
          {product.status !== "Archived" && <form action={setProductStatus}><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="status" value="archived"/><button className="btn btn-ghost status-button" type="submit">Archive</button></form>}
          <form action={deleteProduct}><input type="hidden" name="productId" value={product.id}/><button className="btn btn-ghost danger-button" type="submit" aria-label={`Remove ${product.name}`}><Trash2 size={14}/> Remove</button></form>
        </div></td>
      </tr>)}</tbody></table></div> : <div className="admin-product-category-empty">No items have been added to this category yet.</div>}
    </details>)}
  </div>;
}
