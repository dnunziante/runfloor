import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SalesGuideEditor } from "@/components/sales-guide-editor";
import { getTenantProductById } from "@/lib/products/data";

export default async function AdminSalesGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { product } = await getTenantProductById(id);
  if (!product) notFound();

  return <AppShell title="Admin · Sales Guide">
    <PageHeader eyebrow="Tenant product guidance" title={`${product.name} sales guide`} description={`${product.model} · Create approved guidance for sales conversations, demonstrations, objections, and follow-up.`} action={<div className="guide-header-actions"><Link className="btn btn-ghost" href={product.productType === "competitor_product" ? "/admin/competitors" : "/admin/products"}><ArrowLeft size={16}/> {product.productType === "competitor_product" ? "Competitor products" : "Products"}</Link>{product.status === "Published" && <Link className="btn btn-secondary" href={`/products/${product.slug}`}><ExternalLink size={16}/> Preview guide</Link>}</div>}/>
    <SalesGuideEditor product={product}/>
  </AppShell>;
}
