import { isFreeSolo, isSoloPlan } from "@/lib/plans/policy";
import { SoloUpgradePrompt } from "@/components/solo-upgrade-prompt";
import { AppShell } from "@/components/app-shell";
import { BarChart3, Layers3, Zap } from "lucide-react";
import { ProductComparison } from "@/components/product-comparison";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getTenantProducts, getSoloSharedCatalog } from "@/lib/products/data";

export default async function Comparisons({ searchParams }: { searchParams: Promise<{ product?: string; competitor?: string;third?:string;catalog?:string;q?:string }> }) {
  const selection = await searchParams;
  const viewer=await getViewer();const free=isFreeSolo(viewer?.plan);
  let result=free ? await getSoloSharedCatalog({comparison:true,q:selection.q,selected:[selection.product||"",selection.competitor||"",selection.third||""]}) : await getTenantProducts();
  const shared=free || (isSoloPlan(viewer?.plan?.plan_key) && (selection.catalog==="shared" || [selection.product,selection.competitor,selection.third].some(id=>id&&!result.products.some(p=>p.id===id))));
  if(shared&&!free)result=await getSoloSharedCatalog({comparison:true,q:selection.q,selected:[selection.product||"",selection.competitor||"",selection.third||""]});
  const defaults={product:selection.product || result.products.find(p=>p.productType==="our_product" && p.modelYear!==null)?.id,competitor:selection.competitor || result.products.find(p=>p.productType==="competitor_product")?.id,third:selection.third};
  const isRv = viewer ? await getViewerIndustryTemplateKey(viewer) === "rv" : false;

  return <AppShell title="Comparisons" industry={isRv ? "rv" : undefined}>
    <main className={isRv ? "rv-comparisons" : "golf-cart-comparisons"}>
    {isRv ? <section className="rv-comparisons-hero"><div><span>Product Comparison</span><h1>Find the RV That Fits<br/><em>Their Next Adventure.</em></h1><p>Compare features, specs, and value—side by side—to help your customers make confident decisions.</p></div><blockquote>Different Journeys.<br/>A Brighter Tomorrow.</blockquote></section> : <section className="golf-cart-comparisons-hero"><div><span>Product Comparison</span><h1>Make the choice easy<br/><em>to understand.</em></h1><p>Compare features, specs, and value side-by-side to confidently position your products against the competition.</p><div><b><Zap/><span>Side-by-side specs<small>See key differences fast</small></span></b><b><Layers3/><span>Live catalog data<small>Always up to date</small></span></b><b><BarChart3/><span>Sales-ready<small>Built for your team</small></span></b></div></div><blockquote>Know.<br/>Compare.<br/>Sell.</blockquote></section>}
    {free && <SoloUpgradePrompt/>}
    {shared && <form method="get" className="card form-stack"><input type="hidden" name="catalog" value="shared"/>{["product","competitor","third"].map(key=><input key={key} type="hidden" name={key} value={defaults[key as "product"|"competitor"|"third"]||""}/>)}<label>Find comparison models in the shared catalog<input className="input" name="q" defaultValue={selection.q} maxLength={80}/></label><button className="btn">Search models</button></form>}
    {result.error ? <div className="card error-card"><h2>Comparison unavailable</h2><p>{result.error}</p></div> : result.products.length < 2 ? <div className="card output empty"><div><h2>More products are needed</h2><p>{free ? "Try another search. The shared catalog needs at least two suitable models for a comparison." : "Publish at least two products to create a comparison."}</p></div></div> : <ProductComparison key={`${selection.product || ""}:${selection.competitor || ""}`} initialThirdId={selection.third} initialProductId={selection.product} initialCompetitorId={selection.competitor} products={result.products} isRv={isRv} isGolfCart={!isRv}/>}
    </main>
  </AppShell>;
}
