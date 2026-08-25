"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { normalizeGolfCartSpecifications } from "@/lib/products/golf-cart-specifications";

export type ProductActionState = {
  error: string;
  success: string;
  productId?: string;
  organizationId?: string;
};
export type SalesGuideActionState = { error: string; success: string };
export type FamilyImageActionState = { error: string; success: string };
export type ProductEditActionState = { error: string; success: string };
export type ProductOrderActionState = { error: string; success: string };
export type ProductFamilyActionState = { error: string; success: string; familyId?: string };

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function lines(value: FormDataEntryValue | null, limit = 12) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, limit);
}

const allowedFrames = new Set(["", "Powder Coated Steel", "Aluminum"]);
const allowedCapacities = new Set(["", "2 Passengers", "4 Passenger", "6 Passengers"]);
const allowedPowertrains = new Set(["", "48V", "72V"]);

async function requireTenantAdmin() {
  const viewer = await getViewer();
  if (!viewer || !viewer.organizationId || !["tenant_admin", "platform_owner"].includes(viewer.role)) {
    throw new Error("Unauthorized");
  }
  return viewer;
}

export async function createProductFamily(name: string): Promise<ProductFamilyActionState> {
  const viewer = await requireTenantAdmin();
  const familyName = name.trim().slice(0, 120);
  const slug = slugify(familyName);
  if (familyName.length < 2 || !slug) return { error: "Enter a category name with at least two characters.", success: "" };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("product_families").select("id").eq("organization_id", viewer.organizationId).eq("slug", slug).maybeSingle();
  if (existing) return { error: "That product category already exists.", success: "" };
  const { data: lastFamily } = await supabase.from("product_families").select("sort_order").eq("organization_id", viewer.organizationId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from("product_families").insert({ organization_id: viewer.organizationId, name: familyName, slug, description: `Explore ${familyName} models and configurations.`, sort_order: (lastFamily?.sort_order ?? 0) + 10 }).select("id, name").single();
  if (error || !data) return { error: error?.code === "23505" ? "That product category already exists." : "The product category could not be created.", success: "" };
  revalidatePath("/products");
  revalidatePath("/products/families");
  revalidatePath("/admin/products");
  return { error: "", success: `${data.name} was created.`, familyId: data.id };
}

export async function createProduct(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const viewer = await requireTenantAdmin();
  const name = String(formData.get("name") || "").trim();
  const familyId = String(formData.get("familyId") || "");
  const productType = formData.get("productType") === "competitor_product" ? "competitor_product" : "our_product";
  const productCategory = String(formData.get("productCategory") || "").trim().slice(0, 120);
  const model = String(formData.get("model") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const rangeText = String(formData.get("range") || "").trim();
  const seatsText = String(formData.get("seats") || "").trim();
  const powertrainText = String(formData.get("powertrain") || "").trim();
  const dimensions = String(formData.get("dimensions") || "").trim().slice(0, 160);
  const runningDistance = String(formData.get("runningDistance") || "").trim().slice(0, 160);
  const turningRadius = String(formData.get("turningRadius") || "").trim().slice(0, 160);
  const maxLoadCapacity = String(formData.get("maxLoadCapacity") || "").trim().slice(0, 160);
  const price = Number(formData.get("price"));
  const status = formData.get("status") === "published" ? "published" : "draft";
  const highlights = String(formData.get("highlights") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (name.length < 2 || !Number.isFinite(price) || price < 0 || (productType === "our_product" && !/^[0-9a-f-]{36}$/i.test(familyId))) {
    return { error: "Choose a catalog family for an Our Product, enter a product name, and use a valid non-negative price.", success: "" };
  }
  if (!allowedFrames.has(rangeText) || !allowedCapacities.has(seatsText) || !allowedPowertrains.has(powertrainText)) {
    return { error: "Choose a valid frame, capacity, and powertrain.", success: "" };
  }

  const supabase = await createClient();
  const { data: family } = familyId ? await supabase.from("product_families").select("id").eq("id", familyId).eq("organization_id", viewer.organizationId).maybeSingle() : { data: null };
  if (productType === "our_product" && !family) return { error: "Choose a product family from this workspace.", success: "" };
  const productId = crypto.randomUUID();
  const lastQuery = supabase.from("products").select("sort_order").eq("organization_id", viewer.organizationId);
  const { data: lastProduct } = familyId ? await lastQuery.eq("family_id", familyId).order("sort_order", { ascending: false }).limit(1).maybeSingle() : await lastQuery.order("sort_order", { ascending: false }).limit(1).maybeSingle();

  const { error } = await supabase.from("products").insert({
    id: productId,
    organization_id: viewer.organizationId,
    family_id: familyId || null,
    product_type: productType,
    product_category: productCategory || (productType === "competitor_product" ? "Competitor Vehicles" : ""),
    name,
    slug: `${slugify(name)}-${slugify(model || "standard")}`,
    model,
    description,
    base_price_cents: Math.round(price * 100),
    range_text: rangeText,
    seats_text: seatsText,
    powertrain_text: powertrainText,
    dimensions: dimensions || null,
    running_distance: runningDistance || null,
    turning_radius: turningRadius || null,
    max_load_capacity: maxLoadCapacity || null,
    sort_order: (lastProduct?.sort_order ?? -1) + 1,
    highlights,
    visual_theme: "blue",
    status,
  });

  if (error) {
    return { error: error.code === "23505" ? "That product configuration already exists." : "The product could not be saved.", success: "" };
  }

  revalidatePath("/products");
  revalidatePath("/products/families");
  revalidatePath("/comparisons");
  revalidatePath("/admin/products");
  return { error: "", success: `${name} was saved.`, productId, organizationId: viewer.organizationId };
}

export async function saveProductFamilyImage(familyId: string, imagePath: string): Promise<FamilyImageActionState> {
  const viewer = await requireTenantAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(familyId) || !imagePath.startsWith(`${viewer.organizationId}/families/${familyId}/`) || !/\.(jpe?g|png|webp)$/i.test(imagePath)) {
    return { error: "The family image path is invalid.", success: "" };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase.from("product_families").select("image_path, name").eq("id", familyId).eq("organization_id", viewer.organizationId).maybeSingle();
  if (!existing) return { error: "That product family is not available.", success: "" };

  const { data, error } = await supabase.from("product_families").update({ image_path: imagePath, updated_at: new Date().toISOString() }).eq("id", familyId).eq("organization_id", viewer.organizationId).select("name, slug").maybeSingle();
  if (error || !data) return { error: "The family image could not be saved.", success: "" };
  if (existing.image_path && existing.image_path !== imagePath) await supabase.storage.from("product-images").remove([existing.image_path]);

  revalidatePath("/products");
  revalidatePath(`/products/families/${data.slug}`);
  revalidatePath("/admin/products");
  return { error: "", success: `${data.name} image was saved.` };
}

export async function saveProductImagePaths(productId: string, imagePaths: string[]) {
  const viewer = await requireTenantAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(productId) || imagePaths.length > 8) {
    throw new Error("Invalid product gallery");
  }

  const expectedPrefix = `${viewer.organizationId}/${productId}/`;
  if (imagePaths.some((path) => !path.startsWith(expectedPrefix) || !/\.(jpe?g|png|webp)$/i.test(path))) {
    throw new Error("Invalid product image path");
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("products")
    .select("image_path, image_paths")
    .eq("id", productId)
    .eq("organization_id", viewer.organizationId)
    .maybeSingle();
  const { error } = await supabase
    .from("products")
    .update({ image_paths: imagePaths, image_path: imagePaths[0] || null })
    .eq("id", productId)
    .eq("organization_id", viewer.organizationId);

  if (error) throw new Error("The product gallery could not be saved.");
  const previousPaths = Array.from(new Set([...(existing?.image_paths || []), existing?.image_path].filter((path): path is string => Boolean(path))));
  const removedPaths = previousPaths.filter((path) => !imagePaths.includes(path));
  if (removedPaths.length) await supabase.storage.from("product-images").remove(removedPaths);
  revalidatePath("/products");
  revalidatePath("/comparisons");
  revalidatePath("/admin/products");
}

export async function saveWarrantyDocumentPaths(productId: string, documentPaths: string[]) {
  const viewer = await requireTenantAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(productId) || documentPaths.length > 5) throw new Error("Invalid warranty documents");
  const expectedPrefix = `${viewer.organizationId}/${productId}/`;
  if (documentPaths.some((path) => !path.startsWith(expectedPrefix) || !/\.(pdf|docx?)$/i.test(path))) throw new Error("Invalid warranty document path");
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ warranty_document_paths: documentPaths }).eq("id", productId).eq("organization_id", viewer.organizationId);
  if (error) throw new Error("The warranty documents could not be saved.");
  revalidatePath("/products");
  revalidatePath("/admin/products");
}

export async function updateProduct(
  _previousState: ProductEditActionState,
  formData: FormData,
): Promise<ProductEditActionState> {
  const viewer = await requireTenantAdmin();
  const productId = String(formData.get("productId") || "");
  const familyId = String(formData.get("familyId") || "");
  const productType = formData.get("productType") === "competitor_product" ? "competitor_product" : "our_product";
  const name = String(formData.get("name") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const manufacturer = String(formData.get("manufacturer") || "").trim().slice(0, 160);
  const brand = String(formData.get("brand") || "").trim().slice(0, 160);
  const modelYear = Number(formData.get("modelYear") || 0) || null;
  const modelVariant = String(formData.get("modelVariant") || "").trim().slice(0, 160);
  const productCategory = String(formData.get("productCategory") || "").trim().slice(0, 120);
  const price = Number(formData.get("price"));
  const rangeText = String(formData.get("range") || "").trim();
  const seatsText = String(formData.get("seats") || "").trim();
  const powertrainText = String(formData.get("powertrain") || "").trim();
  const dimensions = String(formData.get("dimensions") || "").trim().slice(0, 160);
  const runningDistance = String(formData.get("runningDistance") || "").trim().slice(0, 160);
  const turningRadius = String(formData.get("turningRadius") || "").trim().slice(0, 160);
  const maxLoadCapacity = String(formData.get("maxLoadCapacity") || "").trim().slice(0, 160);
  if (!/^[0-9a-f-]{36}$/i.test(productId) || (productType === "our_product" && !/^[0-9a-f-]{36}$/i.test(familyId)) || name.length < 2 || !Number.isFinite(price) || price < 0) {
    return { error: "Choose a catalog family for an Our Product, enter a product name, and use a valid non-negative price.", success: "" };
  }
  if (!allowedFrames.has(rangeText) || !allowedCapacities.has(seatsText) || !allowedPowertrains.has(powertrainText)) {
    return { error: "Choose a valid frame, capacity, and powertrain.", success: "" };
  }

  const supabase = await createClient();
  const { data: family } = familyId ? await supabase.from("product_families").select("id, slug").eq("id", familyId).eq("organization_id", viewer.organizationId).maybeSingle() : { data: null };
  if (productType === "our_product" && !family) return { error: "Choose a product family from this workspace.", success: "" };

  const { data: existing } = await supabase.from("products").select("specifications").eq("id", productId).eq("organization_id", viewer.organizationId).maybeSingle();
  const specifications = normalizeGolfCartSpecifications({ ...((existing?.specifications || {}) as Record<string, string>) });
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("spec.")) continue;
    const specificationKey = key.slice(5);
    const specificationValue = String(value).trim().slice(0, 4000);
    if (specificationValue) specifications[specificationKey] = specificationValue;
    else delete specifications[specificationKey];
  }
  const combinedDimensions = [specifications.overallLength, specifications.overallWidth, specifications.overallHeight].filter(Boolean).join(" × ");

  const highlights = String(formData.get("highlights") || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8);
  const { data, error } = await supabase.from("products").update({
    family_id: familyId || null,
    product_type: productType,
    product_category: productCategory,
    name,
    slug: `${slugify(name)}-${slugify(model || "standard")}`,
    model,
    manufacturer,
    brand: brand || manufacturer,
    model_year: modelYear,
    model_variant: modelVariant,
    description: String(formData.get("description") || "").trim(),
    base_price_cents: Math.round(price * 100),
    range_text: rangeText,
    seats_text: seatsText,
    powertrain_text: powertrainText,
    dimensions: dimensions || combinedDimensions || null,
    running_distance: runningDistance || specifications.runningDistance || specifications.estimatedRange || null,
    turning_radius: turningRadius || specifications.turningRadius || null,
    max_load_capacity: maxLoadCapacity || specifications.maximumLoadCapacity || specifications.payloadCapacity || null,
    specifications,
    highlights,
    status: formData.get("status") === "published" ? "published" : "draft",
    updated_at: new Date().toISOString(),
  }).eq("id", productId).eq("organization_id", viewer.organizationId).select("slug").maybeSingle();

  if (error || !data) return { error: error?.code === "23505" ? "That product configuration already exists." : "The product could not be updated.", success: "" };
  revalidatePath("/products");
  if (family?.slug) revalidatePath(`/products/families/${family.slug}`);
  revalidatePath(`/products/${data.slug}`);
  revalidatePath("/comparisons");
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}/edit`);
  return { error: "", success: `${name} was updated.` };
}

export async function duplicateProduct(formData: FormData) {
  const viewer = await requireTenantAdmin();
  const productId = String(formData.get("productId") || "");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) throw new Error("Invalid product ID");

  const supabase = await createClient();
  const { data: source } = await supabase.from("products")
    .select("family_id, name, model, description, base_price_cents, range_text, seats_text, powertrain_text, dimensions, running_distance, turning_radius, max_load_capacity, highlights, visual_theme, sales_guide")
    .eq("id", productId).eq("organization_id", viewer.organizationId).maybeSingle();
  if (!source) throw new Error("The product could not be duplicated.");

  const { data: lastProduct } = await supabase.from("products").select("sort_order").eq("organization_id", viewer.organizationId).eq("family_id", source.family_id).order("sort_order", { ascending: false }).limit(1).maybeSingle();

  const duplicateId = crypto.randomUUID();
  const copySuffix = duplicateId.slice(0, 8);
  const { error } = await supabase.from("products").insert({
    id: duplicateId,
    organization_id: viewer.organizationId,
    family_id: source.family_id,
    name: source.name,
    slug: `${slugify(source.name)}-${slugify(source.model || "standard")}-copy-${copySuffix}`,
    model: `${source.model} Copy`.trim(),
    description: source.description,
    base_price_cents: source.base_price_cents,
    range_text: source.range_text,
    seats_text: source.seats_text,
    powertrain_text: source.powertrain_text,
    dimensions: source.dimensions,
    running_distance: source.running_distance,
    turning_radius: source.turning_radius,
    max_load_capacity: source.max_load_capacity,
    sort_order: (lastProduct?.sort_order ?? -1) + 1,
    highlights: source.highlights,
    visual_theme: source.visual_theme,
    sales_guide: source.sales_guide,
    image_path: null,
    image_paths: [],
    status: "draft",
  });
  if (error) throw new Error("The product could not be duplicated.");

  revalidatePath("/admin/products");
  redirect(`/admin/products/${duplicateId}/edit`);
}

export async function saveProductOrder(familyId: string, productIds: string[]): Promise<ProductOrderActionState> {
  const viewer = await requireTenantAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(familyId) || productIds.length > 500 || new Set(productIds).size !== productIds.length || productIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
    return { error: "The product order is invalid.", success: "" };
  }

  const supabase = await createClient();
  const { data: products, error: readError } = await supabase.from("products").select("id, family_id").eq("organization_id", viewer.organizationId).eq("family_id", familyId);
  const savedIds = new Set((products || []).map((product) => product.id));
  if (readError || savedIds.size !== productIds.length || productIds.some((id) => !savedIds.has(id))) {
    return { error: "The category changed before the order could be saved. Refresh and try again.", success: "" };
  }

  for (const [sortOrder, id] of productIds.entries()) {
    const { error } = await supabase.from("products").update({ sort_order: sortOrder, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", viewer.organizationId).eq("family_id", familyId);
    if (error) return { error: "The product order could not be saved.", success: "" };
  }

  revalidatePath("/products");
  revalidatePath("/products/families");
  revalidatePath("/comparisons");
  revalidatePath("/pricing-calculator");
  revalidatePath("/quote-calculator");
  revalidatePath("/admin/products");
  return { error: "", success: "Order saved." };
}

export async function setProductStatus(formData: FormData) {
  const viewer = await requireTenantAdmin();
  const productId = String(formData.get("productId") || "");
  const status = formData.get("status") === "published" ? "published" : "draft";
  if (!/^[0-9a-f-]{36}$/i.test(productId)) throw new Error("Invalid product ID");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("organization_id", viewer.organizationId)
    .select("id")
    .maybeSingle();

  if (error || !data) throw new Error("The product status could not be changed.");
  revalidatePath("/products");
  revalidatePath("/comparisons");
  revalidatePath("/admin/products");
}

export async function saveSalesGuide(
  _previousState: SalesGuideActionState,
  formData: FormData,
): Promise<SalesGuideActionState> {
  const viewer = await requireTenantAdmin();
  const productId = String(formData.get("productId") || "");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { error: "Invalid product.", success: "" };

  const salesGuide = {
    bestFitCustomer: String(formData.get("bestFitCustomer") || "").trim().slice(0, 1200),
    sellingPoints: lines(formData.get("sellingPoints")),
    discoveryQuestions: lines(formData.get("discoveryQuestions")),
    demonstrationSteps: lines(formData.get("demonstrationSteps")),
    objectionResponses: lines(formData.get("objectionResponses")),
    accessoryOpportunities: lines(formData.get("accessoryOpportunities")),
    followUpNotes: String(formData.get("followUpNotes") || "").trim().slice(0, 2000),
    disclaimers: String(formData.get("disclaimers") || "").trim().slice(0, 2000),
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ sales_guide: salesGuide, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("organization_id", viewer.organizationId)
    .select("name, slug")
    .maybeSingle();

  if (error || !data) return { error: "The sales guide could not be saved.", success: "" };
  revalidatePath(`/products/${data.slug}`);
  revalidatePath("/products");
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}/guide`);
  return { error: "", success: `${data.name} sales guide was saved.` };
}

export async function deleteProduct(formData: FormData) {
  const viewer = await requireTenantAdmin();
  const productId = String(formData.get("productId") || "");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) throw new Error("Invalid product ID");

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("image_path, image_paths, warranty_document_paths")
    .eq("id", productId)
    .eq("organization_id", viewer.organizationId)
    .maybeSingle();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("organization_id", viewer.organizationId);

  if (error) throw new Error("The product could not be removed.");
  const storedPaths = Array.from(new Set([...(product?.image_paths || []), product?.image_path].filter((path): path is string => Boolean(path))));
  if (storedPaths.length) {
    await supabase.storage.from("product-images").remove(storedPaths);
  }
  if (product?.warranty_document_paths?.length) await supabase.storage.from("warranty-documents").remove(product.warranty_document_paths);
  revalidatePath("/products");
  revalidatePath("/comparisons");
  revalidatePath("/admin/products");
}
