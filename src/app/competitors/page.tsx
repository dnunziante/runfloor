import { AppShell } from "@/components/app-shell";
import { BadgeDollarSign, BriefcaseBusiness, Columns3, FileSearch, GitCompareArrows, ShieldCheck } from "lucide-react";
import { ProductLibrary } from "@/components/product-library";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getTenantProducts } from "@/lib/products/data";

export default async function CompetitorsPage() {
  const [result, viewer] = await Promise.all([getTenantProducts(), getViewer()]);
  const isRv = viewer ? await getViewerIndustryTemplateKey(viewer) === "rv" : false;
  const canManage = viewer?.role === "platform_owner" || viewer?.role === "tenant_admin";
  const products = result.products.filter((product) => product.productType === "competitor_product");

  return <AppShell title="Competitors" industry={isRv ? "rv" : undefined}>
    <main className={isRv ? "rv-competitors" : "golf-cart-competitors"}>
    {isRv ? <section className="rv-competitors-hero">
      <div><span>Competitor Library</span><h1>Know the Competition.<br/><em>Sell with Confidence.</em></h1><p>Explore competitor RV models, compare specifications, and stay informed on pricing and features.</p>
        <div className="rv-competitors-benefits"><b><Columns3/>Compare models<small>Side by side</small></b><b><FileSearch/>View specs<small>&amp; floorplans</small></b><b><GitCompareArrows/>Track differences<small>Model by model</small></b><b><ShieldCheck/>Help your team<small>Sell smarter</small></b></div>
      </div><blockquote>Know More.<br/>Sell Better.</blockquote>
    </section> : <section className="golf-cart-competitors-hero"><div className="golf-cart-competitors-copy"><span>Competitor Library</span><h1>Know the competition.<br/><em>Sell with confidence.</em></h1><p>Compare competitor golf cart and LSV models, specs, pricing, and key differences so your team can position every recommendation with confidence.</p><div className="golf-cart-competitors-benefits"><b><Columns3/><span>Real specs<small>Side-by-side details</small></span></b><b><BadgeDollarSign/><span>Updated pricing<small>Stay current</small></span></b><b><GitCompareArrows/><span>Easy comparisons<small>Highlight the advantages</small></span></b><b><BriefcaseBusiness/><span>Sales-ready<small>Key talking points</small></span></b></div></div></section>}
    {result.error ? <section className="card error-card"><h2>Competitor models are not available</h2><p>{result.error}</p></section> : <ProductLibrary products={products} live={result.source === "supabase"} competitorMode isRv={isRv} isGolfCart={!isRv} canManage={canManage} emptyMessage="No competitor models have been published yet. Ask your administrator to add Competitor Products in Products and pricing."/>}
    </main>
  </AppShell>;
}
