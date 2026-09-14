import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { AdminProductCategoryList } from "@/components/admin-product-category-list";
import { ProductBulkImport } from "@/components/product-bulk-import";
import { AdminProductForm } from "@/components/admin-product-form";
import { ProductFamilyImageManager } from "@/components/product-family-image-manager";
import { RvProductModels } from "@/components/rv-product-models";
import { getViewer } from "@/lib/auth/viewer";
import { getTenantProductFamilies, getTenantProducts } from "@/lib/products/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminProductCatalogDashboard } from "@/components/admin-product-catalog-dashboard";
import { Boxes, FileText, Package, Plus, Tags, Upload, Users } from "lucide-react";
import { RvCatalogCreator } from "@/components/rv-catalog-creator";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ family?: string; create?: string; tools?: string; q?: string; type?: string; brand?: string; rvType?: string; year?: string; status?: string }> }) {
  const { family: requestedFamilyId = "", create, tools, ...rvFilters } = await searchParams;
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
  const rvManufacturers = new Set(result.products.map((product) => product.manufacturer || product.brand).filter(Boolean));
  const rvActive = result.products.filter((product) => product.status === "Published").length;
  const rvDrafts = result.products.filter((product) => product.status === "Draft").length;

  if (isRvWorkspace) return <AppShell title="Admin · Products" industry="rv">
    <main className="rv-product-admin">
      <section className="rv-product-admin-hero">
        <div className="rv-product-admin-copy"><span>RV Product Management</span><h1>Manage Your RV Inventory</h1><p>Add, edit, and organize RV models with photos, specs, and pricing.<br/>Keep your catalog up to date and ready for your sales team.</p><div className="rv-product-admin-benefits"><b><Package/>Showcase <small>Your Inventory</small></b><b><FileText/>Keep Specs <small>Accurate</small></b><b><Users/>Power Your <small>Sales Team</small></b><b><Tags/>Turn Browsers <small>Into Buyers</small></b></div></div>
        <div className="rv-product-admin-actions"><Link className="btn btn-primary" href="#add-product"><Plus size={17}/> Add Product</Link><Link className="btn btn-ghost" href="#create-catalog"><Boxes size={17}/> Create Catalog</Link><Link className="btn btn-ghost" href="/admin/products?tools=1#document-import"><Upload size={17}/> Import RVs</Link></div>
        <blockquote>Great RVs.<br/>Build Great<br/>Adventures.</blockquote>
      </section>
      <section className="rv-product-admin-metrics" aria-label="Catalog summary">
        <article><Package/><span><small>Total Models</small><strong>{result.products.length}</strong><em>Across all brands</em></span></article>
        <article><Tags/><span><small>Active Models</small><strong>{rvActive}</strong><em>Live in catalog</em></span></article>
        <article><FileText/><span><small>Draft Models</small><strong>{rvDrafts}</strong><em>In progress</em></span></article>
        <article><Users/><span><small>Manufacturers</small><strong>{rvManufacturers.size}</strong><em>Manage brands</em></span></article>
        <article><Boxes/><span><small>Product Families</small><strong>{familyResult.families.length}</strong><em>Organized categories</em></span></article>
      </section>
      <RvCatalogCreator/>
      {result.error && <div className="card error-card"><h2>Catalog unavailable</h2><p>{result.error}</p></div>}
      {viewer?.organizationId && viewer && ["tenant_admin", "platform_owner", "manager"].includes(viewer.role) ? <section className="rv-product-admin-workspace"><AdminProductForm families={familyResult.families} initialFamilyId={familyResult.families.some((family) => family.id === requestedFamilyId) ? requestedFamilyId : ""} isRv/><RvProductModels organizationId={viewer.organizationId} filters={rvFilters} catalogs={familyResult.families}/></section> : null}
      <details className="card rv-product-import-tools" id="document-import" open={Boolean(tools)}><summary>Import and catalog tools</summary><div className="form-stack">
        {viewer?.organizationId && <ProductFamilyImageManager families={familyResult.families} organizationId={viewer.organizationId}/>}
        {viewer && ["tenant_admin", "platform_owner", "manager"].includes(viewer.role) && <section className="card form-stack"><div><h2>Import RV Products</h2><p>Upload RV comparison sheets, brochures, spec sheets, PDFs, images, or spreadsheets. Detected models are added only to this workspace for review.</p></div><form action="/api/product-documents" method="post" encType="multipart/form-data" className="grid grid-2"><input type="hidden" name="returnTo" value="/admin/products"/><input className="input" name="files" type="file" multiple required accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.csv"/><select className="input" name="productType"><option value="our_product">My Products</option><option value="competitor_product">Competitor Products</option></select><input className="input" name="manufacturer" placeholder="Manufacturer / Brand (optional)"/><button className="btn btn-primary"><Upload size={16}/> Extract RVs & Add for Review</button></form></section>}
      </div></details>
    </main>
  </AppShell>;

  return <AppShell title="Admin · Products">
    <AdminProductCatalogDashboard products={result.products} families={categories} initialFamily={requestedFamilyId}/>
    {result.error && <div className="card error-card"><h2>Catalog unavailable</h2><p>{result.error}</p></div>}
    <details className="card" style={{marginTop:18}} open={isRvWorkspace || Boolean(create) || Boolean(tools)}><summary style={{cursor:"pointer",fontWeight:800}}>Advanced catalog tools</summary><div className="form-stack" style={{marginTop:18}}>
    {viewer?.organizationId && <ProductFamilyImageManager families={familyResult.families} organizationId={viewer.organizationId}/>}
    {viewer && ["tenant_admin", "platform_owner", "manager"].includes(viewer.role) && <section className="card form-stack" id="document-import"><div><h2>{isGolfCartWorkspace ? "Extract Golf Cart Products from Documents" : isRvWorkspace ? "Extract RV Products from Documents" : "Extract products from documents"}</h2><p>{isGolfCartWorkspace ? "Upload golf cart comparison sheets, brochures, spec sheets, PDFs, images, or spreadsheets. RunFloor will identify individual models and extract relevant golf cart specifications. Detected models are added to this workspace for review and will never affect another tenant or industry template." : isRvWorkspace ? "Upload RV comparison sheets, brochures, spec sheets, PDFs, images, or spreadsheets. RunFloor will identify individual RV models and floorplans, extract relevant RV specifications, and add them to this workspace for review." : "Upload comparison sheets, brochures, PDFs, images, or spreadsheets. Detected models are added to this workspace for review; they never affect another tenant or industry template."}</p></div><form action="/api/product-documents" method="post" encType="multipart/form-data" className="grid grid-2"><input type="hidden" name="returnTo" value="/admin/products"/><input className="input" name="files" type="file" multiple required accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.csv"/><select className="input" name="productType"><option value="our_product">My Products</option><option value="competitor_product">Competitor Products</option></select><input className="input" name="manufacturer" placeholder={isGolfCartWorkspace || isRvWorkspace ? "Manufacturer / Brand (optional)" : "Manufacturer (optional)"}/><button className="btn btn-primary">{isGolfCartWorkspace ? "Extract Golf Carts & Add for Review" : isRvWorkspace ? "Extract RVs & Add for Review" : "Extract and add for review"}</button></form></section>}
    {!isRvWorkspace && <div className="admin-product-layout" style={{marginTop:18}}>
      <div id="add-product"><AdminProductForm families={familyResult.families} initialFamilyId={familyResult.families.some((family) => family.id === requestedFamilyId) ? requestedFamilyId : ""}/></div>
      <div id="bulk-import"><ProductBulkImport /></div>
      <div className="card">
        <div className="metric-row"><h2>Workspace products</h2><span className="badge blue">{result.products.length} total</span></div>
        {result.products.length ? <AdminProductCategoryList key={result.products.map((product) => `${product.id}:${product.status}:${product.sortOrder}`).join("|")} categories={categories.map((family) => ({ ...family, products: result.products.filter((product) => product.familyId === family.id) }))}/> : <div className="output empty"><div><h3>No products yet</h3><p>Add the first product for this organization.</p></div></div>}
      </div>
    </div>}
    </div></details>
  </AppShell>;
}
