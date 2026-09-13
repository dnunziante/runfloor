import { AppShell } from "@/components/app-shell";
import { Columns3, FileSearch, GitCompareArrows, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ProductLibrary } from "@/components/product-library";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getTenantProducts } from "@/lib/products/data";

export default async function CompetitorsPage() {
  const [result, viewer] = await Promise.all([getTenantProducts(), getViewer()]);
  const isRv = viewer ? await getViewerIndustryTemplateKey(viewer) === "rv" : false;
  const products = result.products.filter((product) => product.productType === "competitor_product");

  return <AppShell title="Competitors" industry={isRv ? "rv" : undefined}>
    <main className={isRv ? "rv-competitors" : undefined}>
    {isRv ? <section className="rv-competitors-hero">
      <div><span>Competitor Library</span><h1>Know the Competition.<br/><em>Sell with Confidence.</em></h1><p>Explore competitor RV models, compare specifications, and stay informed on pricing and features.</p>
        <div className="rv-competitors-benefits"><b><Columns3/>Compare models<small>Side by side</small></b><b><FileSearch/>View specs<small>&amp; floorplans</small></b><b><GitCompareArrows/>Track differences<small>Model by model</small></b><b><ShieldCheck/>Help your team<small>Sell smarter</small></b></div>
      </div><blockquote>Know More.<br/>Sell Better.</blockquote>
    </section> : <PageHeader eyebrow="Competitor Library" title="Explore competitor models" description="Browse competitor models, images, pricing, and specifications published in your workspace."/>}
    {result.error ? <section className="card error-card"><h2>Competitor models are not available</h2><p>{result.error}</p></section> : <ProductLibrary products={products} live={result.source === "supabase"} competitorMode isRv={isRv} emptyMessage="No competitor models have been published yet. Ask your administrator to add Competitor Products in Products and pricing."/>}
    </main>
  </AppShell>;
}
