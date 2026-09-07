"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Archive, ArrowRight, BookOpen, Boxes, Building2, CheckCircle2, Download, FileUp, LayoutGrid, ListFilter, Plus, Search, Tags, Zap } from "lucide-react";
import { AdminProductCategoryList } from "@/components/admin-product-category-list";
import type { ProductDTO, ProductFamilyDTO } from "@/lib/products/types";
import "./competitor-workspace.css";

const sections = ["Overview", "Products", "Brand families", "Import / Extract", "Archived"] as const;
type Section = typeof sections[number];

export function CompetitorWorkspace({ products, allProducts, families, selectedFamily, productForm, extraction, familyManager, familyForm, bulkImport }: {
  products: ProductDTO[]; allProducts: ProductDTO[]; families: ProductFamilyDTO[]; selectedFamily?: ProductFamilyDTO;
  productForm: ReactNode; extraction: ReactNode; familyManager: ReactNode; familyForm: ReactNode; bulkImport: ReactNode;
}) {
  const [section, setSection] = useState<Section>("Overview");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [createFamily, setCreateFamily] = useState(false);
  const brandName = (product: ProductDTO) => product.brand || product.manufacturer || "Brand not provided";
  const brands = Array.from(new Set(products.map(brandName))).sort();
  const categories = Array.from(new Set(products.map((product) => product.productCategory).filter((value): value is string => Boolean(value)))).sort();
  const shown = products.filter((product) => (!query || [product.name, product.model, product.modelYear, brandName(product)].join(" ").toLowerCase().includes(query.trim().toLowerCase())) && (!brand || brandName(product) === brand) && (!category || product.productCategory === category) && (section === "Archived" ? product.status === "Archived" : !status || product.status === status));
  const groups = brands.map((name) => ({ id: name, name, slug: name, description: "", imageUrl: null, imagePath: null, productCount: 0, products: shown.filter((product) => brandName(product) === name) })).filter((group) => group.products.length);
  const show = (...values: Section[]) => values.includes(section);
  function go(value: Section) { setSection(value); }
  function exportProducts() {
    const cell = (value: unknown) => { let text = String(value ?? ""); if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
    const rows = [["Brand", "Model Name", "Configuration", "Model Year", "Category", "Price", "Status"], ...shown.map((product) => [brandName(product), product.name, product.model, product.modelYear, product.productCategory, product.price, product.status])];
    const url = URL.createObjectURL(new Blob(["\uFEFF", rows.map((row) => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "competitor-products.csv"; link.click(); URL.revokeObjectURL(url);
  }
  const metrics = [
    [Boxes, allProducts.length, "Total competitor products", "blue"],
    [Building2, families.length, "Brand families", "blue"],
    [CheckCircle2, allProducts.filter((product) => product.status === "Published").length, "Published models", "green"],
    [Archive, allProducts.filter((product) => product.status === "Archived").length, "Archived models", "purple"],
  ] as const;
  return <div className="competitor-workspace">
    <header className="cw-heading"><div><span className="eyebrow">Tenant competitor catalog</span><h1>Competitor products and pricing</h1><p>Upload and manage competitor models, images, pricing, and visibility for this workspace.</p></div><div className="cw-actions"><Link className="btn btn-secondary" href="/competitors"><BookOpen size={16}/> View Competitor Library</Link><button className="btn btn-ghost" onClick={exportProducts}><Download size={16}/> Export</button><button className="btn btn-primary" onClick={() => {go("Overview"); requestAnimationFrame(() => document.getElementById("competitor-entry")?.scrollIntoView({ behavior: "smooth" }));}}><Plus size={17}/> Add Competitor Product</button></div></header>
    <div className="cw-metrics">{metrics.map(([Icon, value, label, color]) => <section className="card cw-metric" key={label}><span className={`cw-icon ${color}`}><Icon size={24}/></span><div><strong>{value}</strong><span>{label}</span></div></section>)}</div>
    <nav className="cw-tabs" aria-label="Competitor catalog sections">{sections.map((item, index) => {const Icon = [LayoutGrid, Boxes, Building2, FileUp, Archive][index]; return <button key={item} className={section === item ? "active" : ""} aria-current={section === item ? "page" : undefined} onClick={() => go(item)}><Icon size={16}/>{item}</button>;})}</nav>
    {selectedFamily && <div className="cw-scope"><Tags size={15}/><span>Viewing <strong>{selectedFamily.name}</strong> models and configurations</span><Link href="/admin/competitors">View all brands <ArrowRight size={14}/></Link></div>}
    <div className="cw-entry" hidden={!show("Overview", "Import / Extract")}>
      <div id="competitor-entry" hidden={!show("Overview")}>{productForm}</div>
      <div className="cw-import-column">{extraction}<div className="cw-import-tip"><FileUp size={20}/><div><strong>Review before publishing</strong><p>Document extraction creates drafts. Review the model details and pricing before making them visible to your team.</p></div></div></div>
    </div>
    <div className="cw-middle" hidden={!show("Overview", "Brand families")}>
      <div className="cw-families"><div className="cw-section-heading"><div><Building2 size={19}/><h2>Brand families</h2></div><button className="btn btn-primary" onClick={() => setCreateFamily(!createFamily)} aria-expanded={createFamily}><Plus size={16}/> Add Brand Family</button></div><div hidden={!createFamily}>{familyForm}</div>{familyManager}</div>
      <section className="card cw-quick"><h2><Zap size={18}/> Quick actions</h2><div><button onClick={() => go("Import / Extract")}><FileUp size={19}/><span><strong>Bulk upload products</strong><small>Import CSV or Excel</small></span></button><button onClick={() => go("Archived")}><Archive size={19}/><span><strong>View archived items</strong><small>Review and republish models</small></span></button><button onClick={() => {go("Brand families");setCreateFamily(true);}}><Building2 size={19}/><span><strong>Manage brand families</strong><small>Organize models and covers</small></span></button><button onClick={exportProducts}><Download size={19}/><span><strong>Export product list</strong><small>Download current results as CSV</small></span></button></div></section>
    </div>
    <div className="cw-bulk" hidden={!show("Import / Extract")}>{bulkImport}</div>
    <section className="card cw-products" hidden={!show("Overview", "Products", "Archived")}>
      <div className="cw-section-heading"><div><ListFilter size={19}/><h2>{section === "Archived" ? "Archived products" : "Competitor products"} <span>({shown.length})</span></h2></div><span className="field-help">Edit details, pricing, images, and publishing status.</span></div>
      <div className="cw-filters"><label className="cw-search"><Search size={16}/><input className="input" aria-label="Search competitor products" placeholder="Search by model, brand, or year..." value={query} onChange={(event) => setQuery(event.target.value)}/></label><select className="input" aria-label="Filter by brand" value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">All brands</option>{brands.map((name) => <option key={name}>{name}</option>)}</select><select className="input" aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((name) => <option key={name}>{name}</option>)}</select><select className="input" aria-label="Filter by status" disabled={section === "Archived"} value={section === "Archived" ? "Archived" : status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["Draft", "Published", "Archived"].map((name) => <option key={name}>{name}</option>)}</select></div>
      {shown.length ? <AdminProductCategoryList key={JSON.stringify(shown)} categories={groups} allowReorder={false} expanded/> : <div className="cw-empty"><Search size={25}/><h3>No products to display</h3><p>{products.length ? "Try another filter or search." : "Add a competitor model or import a spreadsheet to get started."}</p></div>}
      {(query || brand || category || status) && <button className="btn btn-ghost" onClick={() => {setQuery("");setBrand("");setCategory("");setStatus("");}}>Clear filters</button>}
    </section>
  </div>;
}
