"use server";
import { isFreeSolo } from "@/lib/plans/policy";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { hasPagePermission } from "@/lib/auth/role-permissions";
import { createClient } from "@/lib/supabase/server";
import type { ProductType } from "@/lib/products/types";

export type ProductTypeState = { error: string; success: string; productType?: ProductType };

export async function saveProductType(_previous: ProductTypeState, formData: FormData): Promise<ProductTypeState> {
  const viewer = await getViewer();
  if (isFreeSolo(viewer?.plan) && viewer?.role !== "platform_owner") throw new Error("Upgrade to Sales Solo to edit inventory, documents or templates.");
  if (!viewer || viewer.demo || !viewer.organizationId || !["platform_owner", "tenant_admin", "manager"].includes(viewer.role) || !hasPagePermission(viewer.role, "/products", viewer.permissions)) return { error: "Sign in with product management access to change the product type.", success: "" };
  const id = String(formData.get("productId") || "");
  const productType = formData.get("productType");
  if (!/^[0-9a-f-]{36}$/i.test(id) || (productType !== "our_product" && productType !== "competitor_product")) return { error: "Choose My product or Competitor product.", success: "" };
  const db = await createClient();
  const { data: product, error: readError } = await db.from("products").select("id,slug,family_id,product_type").eq("id", id).eq("organization_id", viewer.organizationId).maybeSingle();
  if (readError || !product) return { error: "This product is not available in your workspace.", success: "" };
  const update: { product_type: ProductType; updated_at: string; family_id?: null } = { product_type: productType, updated_at: new Date().toISOString() };
  if (product.family_id && product.product_type !== productType) {
    const { data: family, error } = await db.from("product_families").select("slug").eq("id", product.family_id).eq("organization_id", viewer.organizationId).maybeSingle();
    if (error || !family) return { error: "The product catalog could not be verified. Please try again.", success: "" };
    if (family.slug.startsWith("competitor-brand-") !== (productType === "competitor_product")) update.family_id = null;
  }
  const { data: saved, error } = await db.from("products").update(update).eq("id", id).eq("organization_id", viewer.organizationId).eq("product_type", product.product_type).select("id").maybeSingle();
  if (error || !saved) return { error: "The product type could not be saved. Refresh and try again.", success: "" };
  for (const path of ["/products", "/competitors", "/comparisons", "/admin/products", "/admin/competitors", "/admin/competitor-sources", `/products/${product.slug}`, `/admin/products/${id}/guide`, `/admin/products/${id}/edit`]) revalidatePath(path);
  return { error: "", success: `Saved as ${productType === "our_product" ? "My product" : "Competitor product"}.`, productType };
}
