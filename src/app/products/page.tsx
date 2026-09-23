import { AppShell } from "@/components/app-shell";
import { BarChart3, Car, FileText, PackageCheck, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ProductFamilyLibrary } from "@/components/product-family-library";
import { ProductLibrary } from "@/components/product-library";
import { ProductLibraryActions } from "@/components/product-catalog-management";
import { getTenantProductFamilies, getTenantProducts } from "@/lib/products/data";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";

export default async function ProductsPage() {
  const [result, productResult, viewer] = await Promise.all([getTenantProductFamilies(), getTenantProducts(), getViewer()]);
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const isRv = templateKey === "rv";
  const isGolfCart = templateKey === "golf-cart";
  const rvOwnedProducts = isRv ? productResult.products.filter((product) => product.productType === "our_product") : [];
  const addOnFamilies = result.families.filter((family) => ["accessories", "warranties"].includes(family.slug));
  const addOnFamilyIds = new Set(addOnFamilies.map((family) => family.id));
  const golfCartProducts = isGolfCart ? productResult.products.filter((product) => product.productType !== "competitor_product" && (!product.familyId || !addOnFamilyIds.has(product.familyId))) : [];
  const rvOwnedCounts = new Map<string, number>();
  rvOwnedProducts.forEach((product) => { if (product.familyId) rvOwnedCounts.set(product.familyId, (rvOwnedCounts.get(product.familyId) || 0) + 1); });
  const visibleFamilies = isRv ? result.families.filter((family) => rvOwnedCounts.has(family.id)).map((family) => ({ ...family, productCount: rvOwnedCounts.get(family.id) || 0 })) : result.families;
  const canManage = Boolean(viewer && !viewer.demo && ["tenant_admin", "manager", "platform_owner"].includes(viewer.role));
  const actions = canManage && viewer?.organizationId ? <div style={{ position: "relative" }}><ProductLibraryActions organizationId={viewer.organizationId}/></div> : undefined;
  return <AppShell title="Products" industry={isRv ? "rv" : isGolfCart ? "golf-cart" : undefined}>
    <main className={isRv ? "rv-products" : isGolfCart ? "golf-cart-products" : undefined}>
      {isRv ? <section className="rv-products-hero"><div className="rv-products-actions">{actions}</div><div><span>Product Library</span><h1>Find the Right RV<br/>for <em>Every Customer.</em></h1><p>Browse your organization&apos;s live product positioning, pricing, and key sales details.</p><div className="rv-products-benefits"><b><PackageCheck/> Real inventory<small>Live models &amp; specs</small></b><b><FileText/> Accurate pricing<small>Updated details</small></b><b><Users/> Built for your team<small>Sell smarter, faster</small></b></div></div><blockquote>More Adventures.<br/>Together.</blockquote></section> : isGolfCart ? <section className="golf-cart-products-hero"><div className="golf-cart-products-actions">{actions}</div><div><span>Product Library</span><h1>Find the Perfect Golf Cart<br/>for <em>Every Customer.</em></h1><p>Street legal. Community ready. Built for a better tomorrow.</p><div className="golf-cart-products-benefits"><b><Car/> Street legal<small>Options for every use</small></b><b><Users/> Community focused<small>Fit the customer&apos;s life</small></b><b><ShieldCheck/> Trusted products<small>Approved workspace data</small></b><b><BarChart3/> More opportunities<small>Support revenue growth</small></b></div></div><blockquote>More Freedom.<br/>A Better Way<br/>To Get Around.</blockquote></section> : <PageHeader eyebrow="Product Library" title="Find the right product for every customer" description="Browse your organization’s live product positioning, pricing, and key sales details." action={actions}/>}
      {result.error || ((isRv || isGolfCart) && productResult.error)
        ? <div className="card error-card"><h2>Products are not available</h2><p>{result.error || productResult.error}</p><p>Ask a tenant administrator to confirm the product migration and your workspace membership.</p></div>
        : isRv ? <ProductLibrary products={rvOwnedProducts} live={productResult.source === "supabase"} isRv showInventoryNavigation emptyMessage="No published dealership inventory has been added yet."/> : isGolfCart ? <><ProductLibrary products={golfCartProducts} live={productResult.source === "supabase"} isGolfCart emptyMessage="No published golf cart or LSV models have been added yet."/><ProductFamilyLibrary families={addOnFamilies}/></> : <ProductFamilyLibrary families={visibleFamilies}/>
      }
    </main>
  </AppShell>;
}
