import { AppShell } from "@/components/app-shell";
import { AdminProductCategoryList } from "@/components/admin-product-category-list";
import { ProductBulkImport } from "@/components/product-bulk-import";
import { AdminProductForm } from "@/components/admin-product-form";
import { PageHeader } from "@/components/page-header";
import { ProductFamilyImageManager } from "@/components/product-family-image-manager";
import { getViewer } from "@/lib/auth/viewer";
import { getTenantProductFamilies, getTenantProducts } from "@/lib/products/data";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ family?: string }> }) {
  const { family: requestedFamilyId = "" } = await searchParams;
  const [result, familyResult, viewer] = await Promise.all([getTenantProducts({ includeDrafts: true }), getTenantProductFamilies(), getViewer()]);
  const categoryOrder = ["activev-pulse", "bintelli-beyond", "bintelli-nexus", "sivo-edge", "accessories", "warranties"];
  const categories = [
    ...categoryOrder
    .map((slug) => familyResult.families.find((family) => family.slug === slug))
    .filter((family): family is NonNullable<typeof family> => Boolean(family)),
    ...familyResult.families.filter((family) => !categoryOrder.includes(family.slug)),
  ];

  return <AppShell title="Admin · Products">
    <PageHeader eyebrow="Tenant catalog" title="Products and pricing" description="Changes are stored in Supabase and isolated to the active organization."/>
    {result.error && <div className="card error-card"><h2>Catalog unavailable</h2><p>{result.error}</p></div>}
    {viewer?.organizationId && <ProductFamilyImageManager families={familyResult.families} organizationId={viewer.organizationId}/>}
    {viewer && ["tenant_admin", "platform_owner", "manager"].includes(viewer.role) && <section className="card form-stack" style={{marginTop:18}}><div><h2>Extract products from documents</h2><p>Upload RV comparison sheets, brochures, PDFs, images, or spreadsheets. Detected models are added to this workspace for review; they never affect another tenant or the RV template.</p></div><form action="/api/product-documents" method="post" encType="multipart/form-data" className="grid grid-2"><input type="hidden" name="returnTo" value="/admin/products"/><input className="input" name="files" type="file" multiple required accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xlsx,.csv"/><select className="input" name="productType"><option value="our_product">Our Products</option><option value="competitor_product">Competitor Products</option></select><input className="input" name="manufacturer" placeholder="Manufacturer (optional)"/><button className="btn btn-primary">Extract and add for review</button></form></section>}
    <div className="admin-product-layout" style={{marginTop:18}}>
      <AdminProductForm families={familyResult.families} initialFamilyId={familyResult.families.some((family) => family.id === requestedFamilyId) ? requestedFamilyId : ""}/>
      <ProductBulkImport />
      <div className="card">
        <div className="metric-row"><h2>Workspace products</h2><span className="badge blue">{result.products.length} total</span></div>
        {result.products.length ? <AdminProductCategoryList key={result.products.map((product) => `${product.id}:${product.status}:${product.sortOrder}`).join("|")} categories={categories.map((family) => ({ ...family, products: result.products.filter((product) => product.familyId === family.id) }))}/> : <div className="output empty"><div><h3>No products yet</h3><p>Add the first product for this organization.</p></div></div>}
      </div>
    </div>
  </AppShell>;
}
