import { AppShell } from "@/components/app-shell";
import { BarChart3, Layers3, Zap } from "lucide-react";
import { ProductComparison } from "@/components/product-comparison";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getTenantProducts } from "@/lib/products/data";

export default async function Comparisons() {
  const [result, viewer] = await Promise.all([getTenantProducts(), getViewer()]);
  const isRv = viewer ? await getViewerIndustryTemplateKey(viewer) === "rv" : false;

  return <AppShell title="Comparisons" industry={isRv ? "rv" : undefined}>
    <main className={isRv ? "rv-comparisons" : "golf-cart-comparisons"}>
    {isRv ? <section className="rv-comparisons-hero"><div><span>Product Comparison</span><h1>Find the RV That Fits<br/><em>Their Next Adventure.</em></h1><p>Compare features, specs, and value—side by side—to help your customers make confident decisions.</p></div><blockquote>Different Journeys.<br/>A Brighter Tomorrow.</blockquote></section> : <section className="golf-cart-comparisons-hero"><div><span>Product Comparison</span><h1>Make the choice easy<br/><em>to understand.</em></h1><p>Compare features, specs, and value side-by-side to confidently position your products against the competition.</p><div><b><Zap/><span>Side-by-side specs<small>See key differences fast</small></span></b><b><Layers3/><span>Live catalog data<small>Always up to date</small></span></b><b><BarChart3/><span>Sales-ready<small>Built for your team</small></span></b></div></div><blockquote>Know.<br/>Compare.<br/>Sell.</blockquote></section>}
    {result.error ? <div className="card error-card"><h2>Comparison unavailable</h2><p>{result.error}</p></div> : result.products.length < 2 ? <div className="card output empty"><div><h2>More products are needed</h2><p>Publish at least two products to create a comparison.</p></div></div> : <ProductComparison products={result.products} isRv={isRv} isGolfCart={!isRv}/>}
    </main>
  </AppShell>;
}
