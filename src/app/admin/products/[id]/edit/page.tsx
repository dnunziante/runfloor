import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProductEditor } from "@/components/product-editor";
import { getViewer } from "@/lib/auth/viewer";
import { getTenantProductById, getTenantProductFamilies } from "@/lib/products/data";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ product }, familyResult, viewer] = await Promise.all([getTenantProductById(id), getTenantProductFamilies(), getViewer()]);
  if (!product || !viewer?.organizationId) notFound();
  const db = createAdminClient();
  const { data: organization } = await db.from("organizations").select("industry_template_id").eq("id", viewer.organizationId).maybeSingle();
  const { data: template } = organization?.industry_template_id ? await db.from("industry_templates").select("template_key").eq("id", organization.industry_template_id).maybeSingle() : { data: null };

  return <AppShell title="Edit Product">
    <PageHeader eyebrow="Tenant catalog" title={`Edit ${product.name}`} description={`${product.model || "Standard configuration"} · Update the product details and image gallery.`} action={<Link className="btn btn-ghost" href="/admin/products"><ArrowLeft size={16}/> Products</Link>}/>
    <ProductEditor product={product} families={familyResult.families} organizationId={viewer.organizationId} isGolfCart={template?.template_key === "golf-cart"}/>
  </AppShell>;
}
