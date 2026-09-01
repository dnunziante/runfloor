import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProductLibrary } from "@/components/product-library";
import { CatalogManagementActions } from "@/components/product-catalog-management";
import { getTenantProductFamilyBySlug, getTenantProducts } from "@/lib/products/data";
import { getTenantProductFamilies } from "@/lib/products/data";
import { getViewer } from "@/lib/auth/viewer";

export default async function ProductFamilyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [{ family, error }, allCatalogs, viewer] = await Promise.all([getTenantProductFamilyBySlug(slug), getTenantProductFamilies(), getViewer()]);
  if (!family) notFound();
  const products = await getTenantProducts({ familyId: family.id });
  const addOnMode = family.slug === "accessories" || family.slug === "warranties";

  return <AppShell title={family.name}>
    <PageHeader eyebrow={addOnMode ? "Purchase add-ons" : "Product family"} title={family.name} description={family.description} action={<Link className="btn btn-ghost" href="/products"><ArrowLeft size={16}/> {addOnMode ? "Back to products" : "All product families"}</Link>}/>
    {Boolean(viewer && !viewer.demo && ["tenant_admin", "manager", "platform_owner"].includes(viewer.role)) && <CatalogManagementActions catalog={family} catalogs={allCatalogs.families}/>}
    {error || products.error
      ? <div className="card error-card"><h2>{addOnMode ? "Add-ons" : "Models"} are not available</h2><p>{error || products.error}</p></div>
      : <ProductLibrary products={products.products} live={products.source === "supabase"} addOnMode={addOnMode} emptyMessage={addOnMode ? `No published ${family.name.toLowerCase()} have been added yet.` : `No published ${family.name} models or configurations have been added yet.`}/>
    }
  </AppShell>;
}
