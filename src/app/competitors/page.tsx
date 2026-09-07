import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProductLibrary } from "@/components/product-library";
import { getTenantProducts } from "@/lib/products/data";

export default async function CompetitorsPage() {
  const result = await getTenantProducts();
  const products = result.products.filter((product) => product.productType === "competitor_product");

  return <AppShell title="Competitors">
    <PageHeader eyebrow="Competitor Library" title="Explore competitor models" description="Browse competitor models, images, pricing, and specifications published in your workspace."/>
    {result.error ? <section className="card error-card"><h2>Competitor models are not available</h2><p>{result.error}</p></section> : <ProductLibrary products={products} live={result.source === "supabase"} competitorMode emptyMessage="No competitor models have been published yet. Ask your administrator to add Competitor Products in Products and pricing."/>}
  </AppShell>;
}
