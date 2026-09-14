import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { FileText, PackageCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ProductFamilyLibrary } from "@/components/product-family-library";
import { ProductLibrary } from "@/components/product-library";
import { ProductLibraryActions } from "@/components/product-catalog-management";
import { getTenantProductFamilies, getTenantProducts } from "@/lib/products/data";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";

export default async function ProductsPage() {
  const [result, productResult, viewer] = await Promise.all([getTenantProductFamilies(), getTenantProducts(), getViewer()]);
  const isRv = viewer ? await getViewerIndustryTemplateKey(viewer) === "rv" : false;
  const rvOwnedProducts = isRv ? productResult.products.filter((product) => product.productType === "our_product") : [];
  const rvOwnedCounts = new Map<string, number>();
  rvOwnedProducts.forEach((product) => { if (product.familyId) rvOwnedCounts.set(product.familyId, (rvOwnedCounts.get(product.familyId) || 0) + 1); });
  const visibleFamilies = isRv ? result.families.filter((family) => rvOwnedCounts.has(family.id)).map((family) => ({ ...family, productCount: rvOwnedCounts.get(family.id) || 0 })) : result.families;
  const canManage = Boolean(viewer && !viewer.demo && ["tenant_admin", "manager", "platform_owner"].includes(viewer.role));
  const actions = canManage && viewer?.organizationId ? <div style={{ position: "relative" }}><ProductLibraryActions organizationId={viewer.organizationId}/></div> : undefined;
  return <AppShell title="Products" industry={isRv ? "rv" : undefined}>
    <main className={isRv ? "rv-products" : undefined}>
      {isRv ? <section className="rv-products-hero"><div className="rv-products-actions">{actions}</div><div><span>Product Library</span><h1>Find the Right RV<br/>for <em>Every Customer.</em></h1><p>Browse your organization&apos;s live product positioning, pricing, and key sales details.</p><div className="rv-products-benefits"><b><PackageCheck/> Real inventory<small>Live models &amp; specs</small></b><b><FileText/> Accurate pricing<small>Updated details</small></b><b><Users/> Built for your team<small>Sell smarter, faster</small></b></div></div><blockquote>More Adventures.<br/>Together.</blockquote></section> : <PageHeader eyebrow="Product Library" title="Find the right product for every customer" description="Browse your organization’s live product positioning, pricing, and key sales details." action={actions}/>}
      {result.error || (isRv && productResult.error)
        ? <div className="card error-card"><h2>Products are not available</h2><p>{result.error || productResult.error}</p><p>Ask a tenant administrator to confirm the product migration and your workspace membership.</p></div>
        : isRv ? <><nav className="rv-product-tabs" aria-label="Product library sections"><a href="#models" className="active">Inventory Models</a>{visibleFamilies.map((family) => <Link href={`/products/families/${family.slug}`} key={family.id}>{family.name}</Link>)}<Link href="/comparisons">Compare Models</Link></nav><ProductLibrary products={rvOwnedProducts} live={productResult.source === "supabase"} isRv emptyMessage="No published dealership inventory has been added yet."/></> : <ProductFamilyLibrary families={visibleFamilies}/>
      }
    </main>
  </AppShell>;
}
