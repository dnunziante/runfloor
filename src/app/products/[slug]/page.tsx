import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleHelp, ClipboardCheck, PackagePlus, ShieldCheck, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { getTenantProductBySlug } from "@/lib/products/data";

function GuideList({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? <ul className="sales-guide-list">{items.map((item) => <li key={item}><CheckCircle2 size={16}/><span>{item}</span></li>)}</ul> : <p className="guide-empty">{empty}</p>;
}

function Specification({ label, value }: { label: string; value: string }) {
  return <div className="product-specification"><span>{label}</span><strong>{value || "—"}</strong></div>;
}

function specificationLabel(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (character) => character.toUpperCase());
}

export default async function ProductSalesGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product } = await getTenantProductBySlug(slug);
  if (!product) notFound();
  const guide = product.salesGuide;
  const specifications = [
    ["Frame", product.range], ["Passenger capacity", product.seats], ["Powertrain", product.powertrain], ["Dimensions", product.dimensions], ["Running distance", product.runningDistance], ["Turning radius", product.turningRadius], ["Max load capacity", product.maxLoadCapacity],
    ...Object.entries(product.specifications || {}).map(([key, value]) => [specificationLabel(key), value]),
  ].filter(([, value]) => Boolean(value?.trim())) as Array<[string, string]>;

  return <AppShell title="Product Sales Guide">
    <PageHeader eyebrow="Approved product guidance" title={`${product.name} sales guide`} description={`${product.model} · Use this guide to prepare and lead a consistent customer conversation.`} action={<Link className="btn btn-ghost" href="/products"><ArrowLeft size={16}/> Product Library</Link>}/>
    <section className="sales-guide-hero card">
      <div className={`sales-guide-image ${product.color} ${product.imageUrl ? "has-image" : ""}`} style={product.imageUrl ? {backgroundImage:`url(${product.imageUrl})`} : undefined} role="img" aria-label={`${product.name} primary product image`}/>
      <div><span className="badge blue">{product.status}</span><h2>{product.name} · {product.model}</h2><p>{product.description}</p><div className="chips"><span className="chip">{product.range}</span><span className="chip">{product.seats}</span><span className="chip">{product.powertrain}</span>{product.highlights.map((highlight) => <span className="chip" key={highlight}>{highlight}</span>)}</div><strong className="price">Starting at ${product.price.toLocaleString()}</strong></div>
    </section>
    <section className="card product-specifications-card" aria-labelledby="product-specifications-heading"><div className="guide-section-title"><ClipboardCheck size={20}/><h2 id="product-specifications-heading">Product specifications</h2></div>{specifications.length ? <div className="product-specifications">{specifications.map(([label, value]) => <Specification key={label} label={label} value={value}/>)}</div> : <p className="guide-empty">No approved product specifications have been added yet.</p>}</section>
    <div className="grid grid-2 sales-guide-grid">
      <section className="card"><div className="guide-section-title"><Users size={20}/><h2>Best-fit customer</h2></div>{guide.bestFitCustomer ? <p>{guide.bestFitCustomer}</p> : <p className="guide-empty">Your administrator has not added best-fit guidance yet.</p>}</section>
      <section className="card"><div className="guide-section-title"><ShieldCheck size={20}/><h2>Key selling points</h2></div><GuideList items={guide.sellingPoints} empty="No approved selling points have been added yet."/></section>
      <section className="card"><div className="guide-section-title"><CircleHelp size={20}/><h2>Discovery questions</h2></div><GuideList items={guide.discoveryQuestions} empty="No discovery questions have been added yet."/></section>
      <section className="card"><div className="guide-section-title"><ClipboardCheck size={20}/><h2>Product demonstration</h2></div><GuideList items={guide.demonstrationSteps} empty="No demonstration steps have been added yet."/></section>
      <section className="card"><div className="guide-section-title"><CircleHelp size={20}/><h2>Objections and responses</h2></div><GuideList items={guide.objectionResponses} empty="No approved objection responses have been added yet."/></section>
      <section className="card"><div className="guide-section-title"><PackagePlus size={20}/><h2>Accessories and upgrades</h2></div><GuideList items={guide.accessoryOpportunities} empty="No accessory opportunities have been added yet."/></section>
      <section className="card"><h2>Follow-up guidance</h2>{guide.followUpNotes ? <p>{guide.followUpNotes}</p> : <p className="guide-empty">No follow-up guidance has been added yet.</p>}</section>
      <section className="card guide-disclaimer"><h2>Required disclaimers</h2>{guide.disclaimers ? <p>{guide.disclaimers}</p> : <p className="guide-empty">No product-specific disclaimers have been added. Follow current company policy.</p>}</section>
    </div>
  </AppShell>;
}
