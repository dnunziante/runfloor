"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteTemplateProduct } from "@/app/admin/platform/actions";
import { TopScrollTable } from "@/components/top-scroll-table";

export type TemplateProductRow = {
  id: string; name: string; model: string; model_year: number | null; manufacturer: string; product_category: string; product_type: string; updated_at?: string; specifications: Record<string, string> | null;
};

type SortKey = "type" | "manufacturer" | "model" | "year" | "category";
const pageSize = 50;

export function TemplateProductModels({ products, templateId }: { products: TemplateProductRow[]; templateId: string }) {
  const [sort, setSort] = useState<SortKey>("model");
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(0);
  const rows = useMemo(() => [...products].sort((left, right) => {
    const value = (product: TemplateProductRow) => sort === "type" ? product.product_type : sort === "manufacturer" ? product.manufacturer : sort === "model" ? product.model || product.name : sort === "year" ? String(product.model_year || "") : product.specifications?.rvType || product.product_category;
    return value(left).localeCompare(value(right), undefined, { numeric: true, sensitivity: "base" }) * (ascending ? 1 : -1);
  }), [products, sort, ascending]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const shown = rows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const setSortKey = (key: SortKey) => { setPage(0); if (key === sort) setAscending((current) => !current); else { setSort(key); setAscending(true); } };
  const heading = (label: string, key: SortKey) => <button className="text-button" type="button" onClick={() => setSortKey(key)}>{label}{sort === key ? ascending ? " ↑" : " ↓" : " ↕"}</button>;

  return <div className="form-stack" style={{ marginTop: 16 }}>
    <div className="row-between"><p>{rows.length} model{rows.length === 1 ? "" : "s"} · showing {rows.length ? currentPage * pageSize + 1 : 0}–{Math.min((currentPage + 1) * pageSize, rows.length)}</p><div style={{ display: "flex", gap: 8, alignItems: "center" }}><button className="btn btn-ghost" type="button" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button><span>Page {currentPage + 1} of {totalPages}</span><button className="btn btn-ghost" type="button" disabled={currentPage >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}>Next</button></div></div>
    <TopScrollTable><table className="table"><thead><tr><th>{heading("Type", "type")}</th><th>{heading("Manufacturer", "manufacturer")}</th><th>{heading("Model / Floorplan", "model")}</th><th>{heading("Year", "year")}</th><th>{heading("RV Type", "category")}</th><th>Status</th><th>Actions</th></tr></thead><tbody>{shown.map((product) => { const rvType = product.specifications?.rvType || product.product_category || "—"; const floorplan = product.specifications?.floorplan; return <tr key={product.id}><td><span className={`badge ${product.product_type === "our_product" ? "green" : "blue"}`}>{product.product_type === "our_product" ? "My Product" : "Competitor"}</span></td><td>{product.manufacturer || "—"}</td><td><strong>{product.model || product.name}</strong>{floorplan && floorplan !== product.model ? <small style={{ display: "block", color: "var(--muted)" }}>{floorplan}</small> : null}</td><td>{product.model_year || "—"}</td><td>{rvType}</td><td><span className="badge blue">Template</span></td><td><div className="product-row-actions"><Link className="btn btn-ghost" href={`?edit=${product.id}#add-starter-product`}>Edit</Link><form action={deleteTemplateProduct}><input type="hidden" name="templateId" value={templateId} /><input type="hidden" name="productId" value={product.id} /><button className="btn btn-ghost danger-button">Delete</button></form></div></td></tr>; })}{!shown.length ? <tr><td colSpan={7}>No starter products yet.</td></tr> : null}</tbody></table></TopScrollTable>
    <div className="row-between"><span>Horizontal scroll is available above and below the table.</span><div style={{ display: "flex", gap: 8, alignItems: "center" }}><button className="btn btn-ghost" type="button" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button><span>Page {currentPage + 1} of {totalPages}</span><button className="btn btn-ghost" type="button" disabled={currentPage >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}>Next</button></div></div>
  </div>;
}
