import { redirect } from "next/navigation";
import { ProductFamilyImageManager } from "@/components/product-family-image-manager";
import { CompetitorFamilyForm } from "@/components/competitor-family-form";
import { AppShell } from "@/components/app-shell";
import { CompetitorWorkspace } from "@/components/competitor-workspace";
import { AdminProductForm } from "@/components/admin-product-form";

import { ProductBulkImport } from "@/components/product-bulk-import";
import { getViewer } from "@/lib/auth/viewer";
import { getTenantProducts, getTenantProductFamilies } from "@/lib/products/data";

export default async function AdminCompetitorsPage({ searchParams }: { searchParams: Promise<{ family?: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.organizationId || !["tenant_admin", "platform_owner", "manager"].includes(viewer.role)) redirect("/dashboard");
  const [result, familyResult, filters] = await Promise.all([getTenantProducts({ includeDrafts: true }), getTenantProductFamilies(true), searchParams]);
  const allProducts = result.products.filter((product) => product.productType === "competitor_product");
  const belongs = (product: typeof allProducts[number], family: typeof familyResult.families[number]) => product.familyId === family.id || (!product.familyId && (product.brand || product.manufacturer || "").trim().toLowerCase() === family.name.trim().toLowerCase());
  const families = familyResult.families.map((family) => ({ ...family, productCount: allProducts.filter((product) => belongs(product, family)).length }));
  const selectedFamily = families.find((family) => family.id === filters.family);
  const products = selectedFamily ? allProducts.filter((product) => belongs(product, selectedFamily)) : allProducts;
  const returnTo = selectedFamily ? `/admin/competitors?family=${selectedFamily.id}` : "/admin/competitors";
  return <AppShell title="Competitor catalog">
    {result.error && <section className="card error-card"><h2>Competitor catalog unavailable</h2><p>{result.error}</p></section>}
    {familyResult.error && <p className="form-error" role="alert">{familyResult.error}</p>}
    <CompetitorWorkspace products={products} allProducts={allProducts} families={families} selectedFamily={selectedFamily}
      productForm={<AdminProductForm key={selectedFamily?.id || "all"} families={families} initialFamilyId={selectedFamily?.id} initialBrand={selectedFamily?.name} competitorOnly/>}
      familyForm={<CompetitorFamilyForm/>}
      familyManager={<ProductFamilyImageManager families={families} organizationId={viewer.organizationId} competitor/>}
      bulkImport={<ProductBulkImport competitorOnly/>}
      extraction={<section className="card form-stack">
      <div><h2>Extract competitor products</h2><p>Upload brochures, comparison sheets, PDFs, images, or spreadsheets. Detected competitor models are added as drafts for review.</p></div>
      <form action="/api/product-documents" method="post" encType="multipart/form-data" className="grid grid-2">
        <input type="hidden" name="returnTo" value={returnTo}/>
        <input type="hidden" name="productType" value="competitor_product"/>
        <input type="hidden" name="familyId" value={selectedFamily?.id || ""}/>
        <label><span className="label">Competitor documents</span><input className="input" name="files" type="file" multiple required accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.csv"/></label>
        <label><span className="label">Manufacturer / Brand (optional)</span><input className="input" name="manufacturer" defaultValue={selectedFamily?.name || ""} key={selectedFamily?.id || "all"}/></label>
        <button className="btn btn-primary">Extract and add for review</button>
      </form>
    </section>}
    />
  </AppShell>;
}
