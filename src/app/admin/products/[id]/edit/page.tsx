import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProductEditor } from "@/components/product-editor";
import { getViewer } from "@/lib/auth/viewer";
import { getTenantProductById, getTenantProductFamilies } from "@/lib/products/data";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ product }, familyResult, competitorFamilies, viewer] = await Promise.all([getTenantProductById(id), getTenantProductFamilies(), getTenantProductFamilies(true), getViewer()]);
  if (!product || !viewer?.organizationId) notFound();
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;

  return <AppShell title="Edit Product">
    <PageHeader eyebrow="Workspace catalog" title={`Edit ${product.name}`} description={`${product.model || "Standard configuration"} · Update the product details and image gallery.`} action={<Link className="btn btn-ghost" href={product.productType === "competitor_product" ? "/admin/competitors" : "/admin/products"}><ArrowLeft size={16}/> {product.productType === "competitor_product" ? "Competitor products" : "Products"}</Link>}/>
    <ProductEditor product={product} families={product.productType === "competitor_product" ? competitorFamilies.families : familyResult.families} organizationId={viewer.organizationId} isGolfCart={templateKey === "golf-cart"} isRv={templateKey === "rv"}/>
  </AppShell>;
}
