import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { AdminProductCategoryList } from "@/components/admin-product-category-list";
import { ProductBulkImport } from "@/components/product-bulk-import";
import { AdminProductForm } from "@/components/admin-product-form";
import { PageHeader } from "@/components/page-header";
import { ProductFamilyImageManager } from "@/components/product-family-image-manager";
import { RvProductModels } from "@/components/rv-product-models";
import { getViewer } from "@/lib/auth/viewer";
import { getTenantProductFamilies, getTenantProducts } from "@/lib/products/data";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ family?: string; q?: string; type?: string; rvType?: string; year?: string; status?: string }> }) {
  const { family: requestedFamilyId = "", ...rvFilters } = await searchParams;
  const [result, familyResult, viewer] = await Promise.all([getTenantProducts({ includeDrafts: true }), getTenantProductFamilies(), getViewer()]);
  const supabase = createAdminClient();
  const { data: organization } = viewer?.organizationId
    ? await supabase.from("organizations").select("industry_template_id").eq("id", viewer.organizationId).maybeSingle()
    : { data: null };
  const { data: template } = organization?.industry_template_id
    ? await supabase.from("industry_templates").select("template_key").eq("id", organization.industry_template_id).maybeSingle()
    : { data: null };
  const isGolfCartWorkspace = template?.template_key === "golf-cart";
  const isRvWorkspace = template?.template_key === "rv";
  const categoryOrder = ["activev-pulse", "bintelli-beyond", "bintelli-nexus", "sivo-edge", "accessories", "warranties"];
  const categories = [
    ...categoryOrder
    .map((slug) => familyResult.families.find((family) => family.slug === slug))
    .filter((family): family is NonNullable<typeof family> => Boolean(family)),
    ...familyResult.families.filter((family) => !categoryOrder.includes(family.slug)),
  ];

  return <AppShell title="Admin · Products">
    <PageHeader eyebrow="Tenant catalog" title={isRvWorkspace ? "RV Product Models" : "Products and pricing"} description={isRvWorkspace ? "Review, approve, classify, and manage RV models for this workspace." : "Changes are stored in Supabase and isolated to the active organization."} action={isRvWorkspace ? <Link className="btn btn-ghost" href="/admin/competitor-sources">Open Product Models</Link> : undefined}/>
    {result.error && <div className="card error-card"><h2>Catalog unavailable</h2><p>{result.error}</p></div>}
    {viewer?.organizationId && <ProductFamilyImageManager families={familyResult.families} organizationId={viewer.organizationId}/>}
    {viewer && ["tenant_admin", "platform_owner", "manager"].includes(viewer.role) && <section className="card form-stack" style={{marginTop:18}}><div><h2>{isGolfCartWorkspace ? "Extract Golf Cart Products from Documents" : isRvWorkspace ? "Extract RV Products from Documents" : "Extract products from documents"}</h2><p>{isGolfCartWorkspace ? "Upload golf cart comparison sheets, brochures, spec sheets, PDFs, images, or spreadsheets. RunFloor will identify individual models and extract relevant golf cart specifications. Detected models are added to this workspace for review and will never affect another tenant or industry template." : isRvWorkspace ? "Upload RV comparison sheets, brochures, spec sheets, PDFs, images, or spreadsheets. RunFloor will identify individual RV models and floorplans, extract relevant RV specifications, and add them to this workspace for review." : "Upload comparison sheets, brochures, PDFs, images, or spreadsheets. Detected models are added to this workspace for review; they never affect another tenant or industry template."}</p></div><form action="/api/product-documents" method="post" encType="multipart/form-data" className="grid grid-2"><input type="hidden" name="returnTo" value="/admin/products"/><input className="input" name="files" type="file" multiple required accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.csv"/><select className="input" name="productType"><option value="our_product">My Products</option><option value="competitor_product">Competitor Products</option></select><input className="input" name="manufacturer" placeholder={isGolfCartWorkspace || isRvWorkspace ? "Manufacturer / Brand (optional)" : "Manufacturer (optional)"}/><button className="btn btn-primary">{isGolfCartWorkspace ? "Extract Golf Carts & Add for Review" : isRvWorkspace ? "Extract RVs & Add for Review" : "Extract and add for review"}</button></form></section>}
    {!isRvWorkspace && <div className="admin-product-layout" style={{marginTop:18}}>
      <AdminProductForm families={familyResult.families} initialFamilyId={familyResult.families.some((family) => family.id === requestedFamilyId) ? requestedFamilyId : ""}/>
      <ProductBulkImport />
      <div className="card">
        <div className="metric-row"><h2>Workspace products</h2><span className="badge blue">{result.products.length} total</span></div>
        {result.products.length ? <AdminProductCategoryList key={result.products.map((product) => `${product.id}:${product.status}:${product.sortOrder}`).join("|")} categories={categories.map((family) => ({ ...family, products: result.products.filter((product) => product.familyId === family.id) }))}/> : <div className="output empty"><div><h3>No products yet</h3><p>Add the first product for this organization.</p></div></div>}
      </div>
    </div>}
    {isRvWorkspace && viewer?.organizationId ? <RvProductModels organizationId={viewer.organizationId} filters={rvFilters}/> : null}
  </AppShell>;
}
