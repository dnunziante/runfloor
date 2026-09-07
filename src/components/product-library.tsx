"use client";

import { useState } from "react";
import Link from "next/link";
import { Database, GitCompareArrows, Search } from "lucide-react";
import type { ProductDTO } from "@/lib/products/types";

function ProductGallery({ product }: { product: ProductDTO }) {
  const [activeImage, setActiveImage] = useState(0);
  const imageUrl = product.imageUrls[activeImage] || null;
  return <div className="product-gallery">
    <div className={`product-visual ${product.color} ${imageUrl ? "has-image" : ""}`} style={imageUrl ? {backgroundImage:`url(${imageUrl})`} : undefined} role="img" aria-label={`${product.name} product image ${activeImage + 1}`}/>
    {product.imageUrls.length > 1 && <div className="product-gallery-thumbnails" aria-label={`${product.name} image gallery`}>{product.imageUrls.map((url, index) => <button className={index === activeImage ? "active" : ""} type="button" key={url} onClick={() => setActiveImage(index)} aria-label={`Show ${product.name} image ${index + 1}`} aria-pressed={index === activeImage}><span style={{backgroundImage:`url(${url})`}}/></button>)}</div>}
  </div>;
}

export function ProductLibrary({ products, live, emptyMessage, addOnMode = false, competitorMode = false }: { products: ProductDTO[]; live: boolean; emptyMessage?: string; addOnMode?: boolean; competitorMode?: boolean }) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const brands = Array.from(new Set(products.map((product) => product.brand || product.manufacturer || "").filter(Boolean))).sort();
  const shown = products.filter((product) => `${product.name} ${product.model} ${product.brand || ""} ${product.manufacturer || ""} ${product.modelYear || ""} ${product.modelVariant || ""}`.toLowerCase().includes(query.trim().toLowerCase()) && (!brand || (product.brand || product.manufacturer) === brand));
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
