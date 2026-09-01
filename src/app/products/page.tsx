import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProductFamilyLibrary } from "@/components/product-family-library";
import { ProductLibraryActions } from "@/components/product-catalog-management";
import { getTenantProductFamilies } from "@/lib/products/data";
import { getViewer } from "@/lib/auth/viewer";

export default async function ProductsPage() {
  const [result, viewer] = await Promise.all([getTenantProductFamilies(), getViewer()]);
  const canManage = Boolean(viewer && !viewer.demo && ["tenant_admin", "manager", "platform_owner"].includes(viewer.role));
  return <AppShell title="Products">
    <PageHeader eyebrow="Product Library" title="Find the right product for every customer" description="Browse your organization’s live product positioning, pricing, and key sales details." action={canManage && viewer?.organizationId ? <div style={{ position: "relative" }}><ProductLibraryActions organizationId={viewer.organizationId}/></div> : undefined}/>
    {result.error ? <div className="card error-card"><h2>Products are not available</h2><p>{result.error}</p><p>Ask a tenant administrator to confirm the product migration and your workspace membership.</p></div> : <ProductFamilyLibrary families={result.families}/>}
  </AppShell>;
}
