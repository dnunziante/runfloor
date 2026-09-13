import { AppShell } from "@/components/app-shell";
import { FileText, PackageCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ProductFamilyLibrary } from "@/components/product-family-library";
import { ProductLibraryActions } from "@/components/product-catalog-management";
import { getTenantProductFamilies } from "@/lib/products/data";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";

export default async function ProductsPage() {
  const [result, viewer] = await Promise.all([getTenantProductFamilies(), getViewer()]);
  const isRv = viewer ? await getViewerIndustryTemplateKey(viewer) === "rv" : false;
  const canManage = Boolean(viewer && !viewer.demo && ["tenant_admin", "manager", "platform_owner"].includes(viewer.role));
  const actions = canManage && viewer?.organizationId ? <div style={{ position: "relative" }}><ProductLibraryActions organizationId={viewer.organizationId}/></div> : undefined;
  return <AppShell title="Products" industry={isRv ? "rv" : undefined}>
    <main className={isRv ? "rv-products" : undefined}>
      {isRv ? <section className="rv-products-hero"><div className="rv-products-actions">{actions}</div><div><span>Product Library</span><h1>Find the Right RV<br/>for <em>Every Customer.</em></h1><p>Browse your organization&apos;s live product positioning, pricing, and key sales details.</p><div className="rv-products-benefits"><b><PackageCheck/> Real inventory<small>Live models &amp; specs</small></b><b><FileText/> Accurate pricing<small>Updated details</small></b><b><Users/> Built for your team<small>Sell smarter, faster</small></b></div></div><blockquote>More Adventures.<br/>Together.</blockquote></section> : <PageHeader eyebrow="Product Library" title="Find the right product for every customer" description="Browse your organization’s live product positioning, pricing, and key sales details." action={actions}/>}
      {result.error ? <div className="card error-card"><h2>Products are not available</h2><p>{result.error}</p><p>Ask a tenant administrator to confirm the product migration and your workspace membership.</p></div> : <ProductFamilyLibrary families={result.families} isRv={isRv}/>}
    </main>
  </AppShell>;
}
