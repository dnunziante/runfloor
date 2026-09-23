"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BedDouble, Car, Database, GitCompareArrows, LayoutGrid, List, Ruler, Search, Users, Zap } from "lucide-react";
import type { ProductDTO } from "@/lib/products/types";

function ProductGallery({ product }: { product: ProductDTO }) {
  const [activeImage, setActiveImage] = useState(0);
  const imageUrl = product.imageUrls[activeImage] || null;
  return <div className="product-gallery">
    <div className={`product-visual ${product.color} ${imageUrl ? "has-image" : ""}`} style={imageUrl ? {backgroundImage:`url(${imageUrl})`} : undefined} role="img" aria-label={`${product.name} product image ${activeImage + 1}`}/>
    {product.imageUrls.length > 1 && <div className="product-gallery-thumbnails" aria-label={`${product.name} image gallery`}>{product.imageUrls.map((url, index) => <button className={index === activeImage ? "active" : ""} type="button" key={url} onClick={() => setActiveImage(index)} aria-label={`Show ${product.name} image ${index + 1}`} aria-pressed={index === activeImage}><span style={{backgroundImage:`url(${url})`}}/></button>)}</div>}
  </div>;
}

export function ProductLibrary({ products, live, emptyMessage, addOnMode = false, competitorMode = false, isRv = false, isGolfCart = false, showInventoryNavigation = false }: { products: ProductDTO[]; live: boolean; emptyMessage?: string; addOnMode?: boolean; competitorMode?: boolean; isRv?: boolean; isGolfCart?: boolean; showInventoryNavigation?: boolean }) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [year, setYear] = useState("");
  const [sort, setSort] = useState("popular");
  const [view, setView] = useState<"grid" | "list">("grid");
  const brands = Array.from(new Set(products.map((product) => product.brand || product.manufacturer || "").filter(Boolean))).sort();
  const categories = Array.from(new Set(products.map((product) => product.productCategory || "").filter(Boolean))).sort();
  const years = Array.from(new Set(products.map((product) => product.modelYear).filter((value): value is number => Boolean(value)))).sort((a, b) => b - a);
  const filtered = products.filter((product) => `${product.name} ${product.model} ${product.brand || ""} ${product.manufacturer || ""} ${product.modelYear || ""} ${product.modelVariant || ""}`.toLowerCase().includes(query.trim().toLowerCase()) && (!brand || (product.brand || product.manufacturer) === brand) && (!category || product.productCategory === category) && (!year || String(product.modelYear) === year));
  const shown = [...filtered].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "year" ? (b.modelYear || 0) - (a.modelYear || 0) : (a.sortOrder || 0) - (b.sortOrder || 0));

  if (isGolfCart && !addOnMode && !competitorMode) return <section className="golf-cart-product-library" id="models">
    <div className="golf-cart-product-toolbar">
      <label><Search aria-hidden="true"/><input className="input" aria-label="Search golf carts and LSVs" placeholder="Search models, brands, or features..." value={query} onChange={(event) => setQuery(event.target.value)}/></label>
      <select className="input" aria-label="Filter by brand" value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">All brands</option>{brands.map((name) => <option key={name}>{name}</option>)}</select>
      <select className="input" aria-label="Filter by product category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((name) => <option key={name}>{name}</option>)}</select>
      <button className="btn btn-ghost" type="button" onClick={() => { setQuery(""); setBrand(""); setCategory(""); setYear(""); }}>Clear filters</button>
      <div className="golf-cart-view-toggle"><button className={view === "grid" ? "active" : ""} type="button" onClick={() => setView("grid")}><LayoutGrid/>Grid</button><button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}><List/>List</button></div>
    </div>
    <header className="golf-cart-product-heading"><div><h2>Featured Models</h2><p>{shown.length} published golf cart and LSV model{shown.length === 1 ? "" : "s"} ready for your team.</p></div><span className={`badge ${live ? "" : "amber"}`}><Database size={13}/>{live ? "Live workspace data" : "Demo data"}</span></header>
    {shown.length ? <div className={`golf-cart-product-cards ${view === "list" ? "list" : ""}`}>{shown.map((product) => <article className="golf-cart-product-card" key={product.id}>
      <ProductGallery product={product}/>
      <div className="golf-cart-product-card-body"><span className="golf-cart-product-brand">{product.brand || product.manufacturer || "Golf Cart"}</span><h2>{product.name}</h2><p>{product.description}</p><div className="golf-cart-product-specs">{product.seats && <span><Users/>{product.seats}</span>}{product.powertrain && <span><Zap/>{product.powertrain}</span>}{product.productCategory && <span><Car/>{product.productCategory}</span>}</div><small>Starting at</small><strong>{product.price ? `$${product.price.toLocaleString()}` : "Contact for pricing"}</strong><div className="golf-cart-product-actions"><Link href={`/products/${product.slug}`}>View model <ArrowRight/></Link><Link href="/comparisons"><GitCompareArrows/>Compare</Link></div></div>
    </article>)}</div> : <div className="card output empty"><div><Search size={32}/><h2>No matching models</h2><p>{products.length ? "Try another filter or clear your search." : emptyMessage}</p>{(query || brand || category || year) && <button className="btn btn-secondary" onClick={() => { setQuery(""); setBrand(""); setCategory(""); setYear(""); }}>Clear filters</button>}</div></div>}
    <aside className="golf-cart-product-cta"><Car/><div><strong>Help More People Get Where They Want to Go.</strong><span>Reliable products, approved details, and customer-ready comparisons.</span></div><Link href="/comparisons">Compare models <ArrowRight/></Link></aside>
  </section>;

  if (isRv && !addOnMode && !competitorMode) return <>
    {showInventoryNavigation && <nav className="rv-product-tabs" aria-label="Product inventory navigation"><button type="button" className={!brand ? "active" : undefined} aria-current={!brand ? "page" : undefined} onClick={() => setBrand("")}>Full Inventory</button>{brands.map((name) => <button type="button" className={brand === name ? "active" : undefined} aria-current={brand === name ? "page" : undefined} onClick={() => setBrand(name)} key={name}>{name}</button>)}<Link href="/comparisons">Compare Models</Link></nav>}
    <div className="rv-inventory-library" id="models">
    <div className="rv-inventory-toolbar">
      <label><Search aria-hidden="true"/><input className="input" aria-label="Search inventory" placeholder="Search models, brands, or configurations..." value={query} onChange={(event) => setQuery(event.target.value)}/></label>
      <select className="input" aria-label="Filter by brand" value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">All brands</option>{brands.map((name) => <option key={name}>{name}</option>)}</select>
      <select className="input" aria-label="Filter by RV type" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All RV types</option>{categories.map((name) => <option key={name}>{name}</option>)}</select>
      <select className="input" aria-label="Filter by model year" value={year} onChange={(event) => setYear(event.target.value)}><option value="">All model years</option>{years.map((value) => <option key={value}>{value}</option>)}</select>
      <button className="btn btn-ghost" type="button" onClick={() => { setQuery(""); setBrand(""); setCategory(""); setYear(""); }}>Clear</button>
    </div>
    <div className="rv-inventory-layout">
      <aside className="rv-inventory-filters">
        <h2>RV Type</h2>{categories.map((name) => <button className={category === name ? "active" : ""} type="button" key={name} onClick={() => setCategory(category === name ? "" : name)}><span>{name}</span><small>{products.filter((product) => product.productCategory === name).length}</small></button>)}
        <h2>Brand</h2>{brands.slice(0, 10).map((name) => <button className={brand === name ? "active" : ""} type="button" key={name} onClick={() => setBrand(brand === name ? "" : name)}><span>{name}</span><small>{products.filter((product) => (product.brand || product.manufacturer) === name).length}</small></button>)}
        <h2>Model Year</h2>{years.map((value) => <button className={year === String(value) ? "active" : ""} type="button" key={value} onClick={() => setYear(year === String(value) ? "" : String(value))}><span>{value}</span><small>{products.filter((product) => product.modelYear === value).length}</small></button>)}
        <div className="rv-inventory-callout"><strong>Adventure<br/>Starts Here.</strong><p>Help more families make memories with the right RV.</p></div>
      </aside>
      <section className="rv-inventory-results">
        <header><div><h2>{shown.length} Inventory Model{shown.length === 1 ? "" : "s"}</h2><p>Published dealership products ready for your sales team.</p></div><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">Most Popular</option><option value="name">Model Name</option><option value="year">Newest Year</option></select></label><div className="rv-view-toggle"><button className={view === "grid" ? "active" : ""} type="button" onClick={() => setView("grid")}><LayoutGrid/>Grid</button><button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}><List/>List</button></div></header>
        {shown.length ? <div className={`rv-inventory-cards ${view === "list" ? "list" : ""}`}>{shown.map((product) => {
          const length = product.specifications?.length || product.dimensions;
          const sleeps = product.specifications?.sleepingCapacity || product.seats;
          const displayName = product.modelYear && !product.name.startsWith(String(product.modelYear)) ? `${product.modelYear} ${product.name}` : product.name;
          return <article className="rv-inventory-card" key={product.id}><ProductGallery product={product}/><div className="rv-inventory-card-body"><span className="rv-inventory-brand">{product.brand || product.manufacturer || "RV"}</span><h2>{displayName}</h2><p className="rv-inventory-meta">{[product.productCategory, product.modelVariant || product.model].filter(Boolean).join("  |  ")}</p><div className="rv-inventory-specs">{sleeps && <span><BedDouble/>Sleeps {sleeps}</span>}{length && <span><Ruler/>Length {length}</span>}</div><p>{product.description}</p><Link href={`/products/${product.slug}`}>View product guide <span aria-hidden="true">→</span></Link></div></article>;
        })}</div> : <div className="card output empty"><div><Search size={32}/><h2>No matching inventory</h2><p>{products.length ? "Try another filter or clear your search." : emptyMessage || "No published dealership products have been added yet."}</p>{(query || brand || category || year) && <button className="btn btn-secondary" onClick={() => {setQuery("");setBrand("");setCategory("");setYear("");}}>Clear filters</button>}</div></div>}
      </section>
    </div>
    </div>
  </>;

  if (isRv && competitorMode) return <div className="rv-competitor-library">
    <div className="rv-competitor-toolbar">
      <label><Search aria-hidden="true"/><input className="input" aria-label="Search competitor RVs" placeholder="Search competitor models, brands, or keywords..." value={query} onChange={(event) => setQuery(event.target.value)}/></label>
      <select className="input" aria-label="Filter by competitor brand" value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">All brands</option>{brands.map((name) => <option key={name}>{name}</option>)}</select>
      <select className="input" aria-label="Filter by RV type" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All RV types</option>{categories.map((name) => <option key={name}>{name}</option>)}</select>
      <span className={`badge ${live ? "" : "amber"}`}><Database size={13}/>{live ? "Live workspace data" : "Demo data"}</span>
      <Link className="btn btn-secondary" href="/comparisons"><GitCompareArrows size={16}/> Compare models</Link>
    </div>
    <div className="rv-competitor-layout">
      <aside className="rv-competitor-filters"><header><h2>Filters</h2><button type="button" onClick={() => { setBrand(""); setCategory(""); setYear(""); setQuery(""); }}>Clear all</button></header>
        {categories.length > 0 && <section><h3>RV Type</h3>{categories.map((name) => <button className={category === name ? "active" : ""} type="button" key={name} onClick={() => setCategory(category === name ? "" : name)}><span>{name}</span><small>{products.filter((product) => product.productCategory === name).length}</small></button>)}</section>}
        {brands.length > 0 && <section><h3>Brand</h3>{brands.map((name) => <button className={brand === name ? "active" : ""} type="button" key={name} onClick={() => setBrand(brand === name ? "" : name)}><span>{name}</span><small>{products.filter((product) => (product.brand || product.manufacturer) === name).length}</small></button>)}</section>}
        {years.length > 0 && <section><h3>Model Year</h3>{years.map((value) => <button className={year === String(value) ? "active" : ""} type="button" key={value} onClick={() => setYear(year === String(value) ? "" : String(value))}><span>{value}</span><small>{products.filter((product) => product.modelYear === value).length}</small></button>)}</section>}
      </aside>
      <section className="rv-competitor-results"><header><div><h2>{shown.length} Competitor Model{shown.length === 1 ? "" : "s"}</h2><p>{products.length ? "Showing published models from your workspace" : "Your competitor library is ready for published models"}</p></div><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">Most Popular</option><option value="name">Model Name</option><option value="year">Newest Year</option></select></label><div className="rv-view-toggle"><button className={view === "grid" ? "active" : ""} type="button" onClick={() => setView("grid")}><LayoutGrid/>Grid</button><button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}><List/>List</button></div></header>
        {shown.length ? <div className={`rv-competitor-cards ${view === "list" ? "list" : ""}`}>{shown.map((product) => <article className="rv-competitor-card" key={product.id}><ProductGallery product={product}/><div className="rv-competitor-card-body"><span className="rv-competitor-brand">{product.brand || product.manufacturer || "Competitor RV"}</span><h2>{product.name}</h2><p className="rv-competitor-meta">{[product.modelYear, product.brand || product.manufacturer].filter(Boolean).join("  |  ")}</p><div className="rv-competitor-specs">{[product.seats, product.range, product.powertrain].filter(Boolean).map((value, index) => <span key={`${product.id}-${index}`}>{value}</span>)}</div><p>{product.description}</p><div><Link href={`/products/${product.slug}`}>View product guide</Link><Link href="/comparisons"><GitCompareArrows/>Compare</Link></div></div></article>)}</div> : <div className="card output empty"><div><Search size={32}/><h2>No matching competitor RVs</h2><p>{products.length ? "Try another filter or clear your search." : emptyMessage}</p>{(query || brand || category || year) && <button className="btn btn-secondary" onClick={() => {setQuery("");setBrand("");setCategory("");setYear("");}}>Clear filters</button>}</div></div>}
      </section>
    </div>
  </div>;
  return <>
    <div className="product-toolbar">
      <div style={{position:"relative",maxWidth:440,minWidth:220,flex:1}}><Search size={17} style={{position:"absolute",left:12,top:13,color:"#68738a"}}/><input className="input" style={{paddingLeft:38}} aria-label="Search models or configurations" placeholder={addOnMode ? "Search available add-ons" : "Search models or configurations"} value={query} onChange={(event)=>setQuery(event.target.value)}/></div>
      {competitorMode && <select className="input" style={{width:"auto",maxWidth:"100%"}} aria-label="Filter by competitor brand" value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">All brands</option>{brands.map((name) => <option key={name} value={name}>{name}</option>)}</select>}
      <span className={`badge ${live ? "" : "amber"}`}><Database size={13}/>{live ? "Live workspace data" : "Demo data"}</span>
      {!addOnMode && <Link className="btn btn-secondary" href="/comparisons"><GitCompareArrows size={16}/> Compare models</Link>}
    </div>
    {shown.length ? <div className="grid grid-3">{shown.map((product) => <article className="card" key={product.id}>
      <ProductGallery product={product}/>
      <div className="product-title"><div><h2>{product.name}</h2><p>{competitorMode ? [product.brand || product.manufacturer, product.modelYear, product.modelVariant || product.model].filter(Boolean).join(" / ") : product.model}</p></div><span className="price">{competitorMode && !product.price ? "Price not provided" : `$${product.price.toLocaleString()}`}</span></div>
      <p>{product.description}</p>
      {!addOnMode && <div className="chips"><span className="chip">{product.range}</span><span className="chip">{product.seats}</span><span className="chip">{product.powertrain}</span></div>}
      {addOnMode && product.highlights.length > 0 && <div className="chips">{product.highlights.slice(0,2).map((highlight)=><span className="chip" key={highlight}>{highlight}</span>)}</div>}
      <Link className="btn btn-secondary" style={{width:"100%"}} href={`/products/${product.slug}`}>{addOnMode ? "View add-on details" : "View product guide"}</Link>
    </article>)}</div> : <div className="card output empty"><div><Search size={32}/><h2>No matching products</h2><p>{products.length ? "Try a different model name or clear your search." : emptyMessage || "Your organization has no published products yet."}</p>{(query || brand) && <button className="btn btn-secondary" onClick={()=>{setQuery("");setBrand("");}}>Clear filters</button>}</div></div>}
  </>;
}
