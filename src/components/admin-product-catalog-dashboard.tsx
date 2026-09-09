"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Boxes, ChevronDown, ChevronRight, FileDown, FileText, Grid2X2, Layers3, List, Package, Plus, Search, Tag, Upload, Users } from "lucide-react";
import type { ProductDTO, ProductFamilyDTO } from "@/lib/products/types";
import styles from "./admin-product-catalog-dashboard.module.css";

type Props = { products: ProductDTO[]; families: ProductFamilyDTO[]; initialFamily?: string };

function productLabel(product: ProductDTO) {
  return [product.name, product.model].filter(Boolean).join(" · ");
}

export function AdminProductCatalogDashboard({ products, families, initialFamily = "all" }: Props) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState(initialFamily || "all");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [familyQuery, setFamilyQuery] = useState("");
  const [gridView, setGridView] = useState(true);

  const brands = new Set(products.map((product) => product.brand || product.manufacturer).filter(Boolean));
  const published = products.filter((product) => product.status === "Published" && product.productType !== "competitor_product").length;
  const categories = Array.from(new Set(products.map((product) => product.productCategory).filter(Boolean))).sort();
  const filtered = useMemo(() => products.filter((product) => {
    const haystack = `${product.name} ${product.model} ${product.brand || ""} ${product.manufacturer || ""}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) &&
      (family === "all" || product.familyId === family) &&
      (status === "all" || product.status === status) &&
      (category === "all" || product.productCategory === category);
  }), [products, query, family, status, category]);
  const visibleFamilies = families.filter((item) => !familyQuery || item.name.toLowerCase().includes(familyQuery.toLowerCase()));

  return <div className={styles.catalog}>
    <header className={styles.hero}>
      <div>
        <span className={styles.eyebrow}>Products</span>
        <h1>Products and pricing</h1>
        <p>Manage your workspace catalog, pricing, images, and product information.</p>
      </div>
      <div className={styles.heroActions}>
        <details className={styles.importMenu}>
          <summary><Upload size={17}/> Import products <ChevronDown size={15}/></summary>
          <div>
            <a href="/admin/products?tools=document#document-import"><FileText size={18}/><span><strong>Extract from document</strong><small>PDFs, brochures, and spec sheets</small></span></a>
            <a href="/admin/products?tools=bulk#bulk-import"><Upload size={18}/><span><strong>Upload Excel/CSV</strong><small>Bulk import products</small></span></a>
            <a href="/api/products/bulk-import?format=xlsx"><FileDown size={18}/><span><strong>Download Excel template</strong><small>Use the formatted workbook</small></span></a>
            <a href="/api/products/bulk-import?format=csv"><FileDown size={18}/><span><strong>Download CSV template</strong></span></a>
          </div>
        </details>
        <Link className={styles.primaryButton} href="/admin/products?create=1#add-product"><Plus size={19}/> Add product</Link>
      </div>
    </header>

    <section className={styles.metrics} aria-label="Catalog summary">
      <article><span className={styles.orangeIcon}><Package size={21}/></span><div><strong>{products.length}</strong><small>Total products</small></div></article>
      <article><span><Layers3 size={21}/></span><div><strong>{families.length}</strong><small>Product families</small></div></article>
      <article><span><Tag size={21}/></span><div><strong>{brands.size}</strong><small>Brands</small></div></article>
      <article><span><Users size={21}/></span><div><strong>{published}</strong><small>Active catalog</small></div></article>
    </section>

    <nav className={styles.chips} aria-label="Product category filters">
      <button className={category === "all" ? styles.activeChip : ""} onClick={() => setCategory("all")}>All ({products.length})</button>
      {categories.map((item) => <button className={category === item ? styles.activeChip : ""} onClick={() => setCategory(item!)} key={item}>{item} ({products.filter((product) => product.productCategory === item).length})</button>)}
    </nav>

    <section className={styles.panel}>
      <div className={styles.sectionHead}>
        <div><h2>Product families</h2><p>Select a product family to manage models, pricing, and images.</p></div>
        <div className={styles.familyControls}>
          <label><Search size={16}/><input value={familyQuery} onChange={(event) => setFamilyQuery(event.target.value)} placeholder="Find a family" aria-label="Find a product family"/></label>
          <div className={styles.viewToggle} aria-label="Family view"><button className={gridView ? styles.selected : ""} onClick={() => setGridView(true)} aria-label="Grid view"><Grid2X2 size={17}/></button><button className={!gridView ? styles.selected : ""} onClick={() => setGridView(false)} aria-label="List view"><List size={18}/></button></div>
        </div>
      </div>
      <div className={gridView ? styles.familyGrid : styles.familyList}>
        {visibleFamilies.map((item) => <article className={styles.familyCard} key={item.id}>
          <div className={styles.familyImage} style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}>{!item.imageUrl && <Boxes size={34}/>}</div>
          <div className={styles.familyBody}><h3>{item.name}</h3><p>{item.productCount} {item.productCount === 1 ? "configuration" : "configurations"}</p><small>{products.find((product) => product.familyId === item.id)?.productCategory || "Product family"}</small>
            <Link href={`/admin/products?family=${item.id}#all-products`}>Manage products <ChevronRight size={16}/></Link>
          </div>
        </article>)}
      </div>
    </section>

    <section className={`${styles.panel} ${styles.productsPanel}`} id="all-products">
      <div className={styles.sectionHead}>
        <div><h2>All products ({filtered.length})</h2><p>Search, filter, and manage individual products across all families.</p></div>
        <div className={styles.productFilters}>
          <label><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products…" aria-label="Search products"/></label>
          <select value={family} onChange={(event) => setFamily(event.target.value)} aria-label="Filter by family"><option value="all">All families</option>{families.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option>Published</option><option>Draft</option><option>Archived</option></select>
        </div>
      </div>
      <div className={styles.tableWrap}><table><thead><tr><th>Product name</th><th>Family</th><th>Category</th><th>Model year</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {filtered.map((product) => <tr key={product.id}><td><div className={styles.productName}>{product.imageUrl ? <span style={{backgroundImage:`url(${product.imageUrl})`}} role="img" aria-label={`${product.name} thumbnail`}/> : <span className={styles.placeholder}><Package size={16}/></span>}<strong>{productLabel(product)}</strong></div></td><td>{families.find((item) => item.id === product.familyId)?.name || "Uncategorized"}</td><td>{product.productCategory || "—"}</td><td>{product.modelYear || "—"}</td><td>{product.price ? `$${product.price.toLocaleString()}` : "—"}</td><td><span className={`${styles.status} ${styles[product.status.toLowerCase()]}`}>{product.status}</span></td><td><div className={styles.rowActions}><Link href={`/admin/products/${product.id}/edit`}>Edit</Link><Link href={`/admin/products/${product.id}/guide`}>Sales guide</Link></div></td></tr>)}
        {!filtered.length && <tr><td className={styles.empty} colSpan={7}>No products match these filters.</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}
