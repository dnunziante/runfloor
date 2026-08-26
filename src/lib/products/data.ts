import "server-only";

import { getViewer } from "@/lib/auth/viewer";
import { demoProductFamilies as demoFamilies, demoProducts } from "@/lib/demo/catalog";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ProductDTO, ProductFamilyResult, ProductResult, ProductStatus, ProductType, SalesGuideDTO } from "./types";

type ProductRow = {
  id: string;
  family_id: string | null;
  name: string;
  slug: string;
  model: string;
  brand: string;
  manufacturer: string;
  model_year: number | null;
  model_variant: string;
  product_type: ProductType;
  product_category: string;
  sale_price_cents: number | null;
  specifications: Record<string, unknown> | null;
  description: string;
  base_price_cents: number;
  range_text: string;
  seats_text: string;
  powertrain_text: string;
  dimensions: string | null;
  running_distance: string | null;
  turning_radius: string | null;
  max_load_capacity: string | null;
  sort_order: number;
  highlights: string[] | null;
  visual_theme: string;
  image_path: string | null;
  image_paths: string[] | null;
  sales_guide: Partial<SalesGuideDTO> | null;
  status: "draft" | "published" | "archived";
};

type ProductFamilyRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_path: string | null;
  products: { count: number }[] | null;
};

const statusLabels: Record<ProductRow["status"], ProductStatus> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const emptySalesGuide: SalesGuideDTO = {
  bestFitCustomer: "",
  sellingPoints: [],
  discoveryQuestions: [],
  demonstrationSteps: [],
  objectionResponses: [],
  accessoryOpportunities: [],
  followUpNotes: "",
  disclaimers: "",
};

function toDTO(row: ProductRow, imageUrls: string[] = [], imagePaths: string[] = []): ProductDTO {
  return {
    id: row.id,
    familyId: row.family_id,
    name: row.name,
    slug: row.slug,
    model: row.model,
    brand: row.brand || "",
    manufacturer: row.manufacturer || "",
    modelYear: row.model_year,
    modelVariant: row.model_variant || "",
    productType: row.product_type || "our_product",
    productCategory: row.product_category || "",
    salePrice: row.sale_price_cents === null ? null : row.sale_price_cents / 100,
    specifications: Object.fromEntries(Object.entries(row.specifications || {}).filter(([, value]) => typeof value === "string").map(([key, value]) => [key, value as string])),
    description: row.description,
    price: row.base_price_cents / 100,
    range: row.range_text,
    seats: row.seats_text,
    powertrain: row.powertrain_text,
    dimensions: row.dimensions || "",
    runningDistance: row.running_distance || "",
    turningRadius: row.turning_radius || "",
    maxLoadCapacity: row.max_load_capacity || "",
    sortOrder: row.sort_order,
    highlights: row.highlights || [],
    color: row.visual_theme,
    imageUrl: imageUrls[0] || null,
    imageUrls,
    imagePaths,
    salesGuide: { ...emptySalesGuide, ...(row.sales_guide || {}) },
    status: statusLabels[row.status],
  };
}

export async function getTenantProducts(options: { includeDrafts?: boolean; familyId?: string } = {}): Promise<ProductResult> {
  const viewer = await getViewer();
  if (viewer?.demo || isLocalDemoMode() || !isSupabaseConfigured()) {
    return { products: options.familyId ? demoProducts.filter((product) => product.familyId === options.familyId) : demoProducts, source: "demo" };
  }

  if (!viewer?.organizationId) {
    return { products: [], source: "supabase", error: "Your account is not assigned to an organization." };
  }

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, family_id, name, slug, model, brand, manufacturer, model_year, model_variant, product_type, product_category, sale_price_cents, specifications, description, base_price_cents, range_text, seats_text, powertrain_text, dimensions, running_distance, turning_radius, max_load_capacity, sort_order, highlights, visual_theme, image_path, image_paths, sales_guide, status")
    .eq("organization_id", viewer.organizationId)
    .order("sort_order")
    .order("name");

  if (!options.includeDrafts) query = query.eq("status", "published");
  if (options.familyId) query = query.eq("family_id", options.familyId);

  const { data, error } = await query;
  if (error) {
    return { products: [], source: "supabase", error: "Products could not be loaded from the workspace." };
  }

  const rows = data as ProductRow[];
  const paths = Array.from(new Set(rows.flatMap((row) => row.image_paths?.length ? row.image_paths : row.image_path ? [row.image_path] : [])));
  const imageUrls = new Map<string, string>();

  if (paths.length) {
    const { data: signedImages } = await supabase.storage
      .from("product-images")
      .createSignedUrls(paths, 60 * 60);

    signedImages?.forEach((image) => {
      if (image.path && image.signedUrl) imageUrls.set(image.path, image.signedUrl);
    });
  }

  return {
    products: rows.map((row) => {
      const productPaths = row.image_paths?.length ? row.image_paths : row.image_path ? [row.image_path] : [];
      return toDTO(row, productPaths.map((path) => imageUrls.get(path)).filter((url): url is string => Boolean(url)), productPaths);
    }),
    source: "supabase",
  };
}

export async function getTenantProductFamilies(): Promise<ProductFamilyResult> {
  const viewer = await getViewer();
  if (viewer?.demo || isLocalDemoMode() || !isSupabaseConfigured()) return { families: demoFamilies, source: "demo" };
  if (!viewer?.organizationId) return { families: [], source: "supabase", error: "Your account is not assigned to an organization." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_families")
    .select("id, name, slug, description, image_path, products(count)")
    .eq("organization_id", viewer.organizationId)
    .order("sort_order")
    .order("name");

  if (error) return { families: [], source: "supabase", error: "Product families could not be loaded from the workspace." };
  const rows = data as ProductFamilyRow[];
  const paths = rows.map((row) => row.image_path).filter((path): path is string => Boolean(path));
  const signedUrls = new Map<string, string>();
  if (paths.length) {
    const { data: signedImages } = await supabase.storage.from("product-images").createSignedUrls(paths, 60 * 60);
    signedImages?.forEach((image) => { if (image.path && image.signedUrl) signedUrls.set(image.path, image.signedUrl); });
  }

  return {
    families: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imagePath: row.image_path,
      imageUrl: row.image_path ? signedUrls.get(row.image_path) || null : null,
      productCount: row.products?.[0]?.count || 0,
    })),
    source: "supabase",
  };
}

export async function getTenantProductFamilyBySlug(slug: string) {
  const result = await getTenantProductFamilies();
  return { family: result.families.find((family) => family.slug === slug) || null, error: result.error };
}

export async function getTenantProductBySlug(slug: string) {
  const result = await getTenantProducts();
  return { product: result.products.find((product) => product.slug === slug) || null, error: result.error };
}

export async function getTenantProductById(id: string) {
  const result = await getTenantProducts({ includeDrafts: true });
  return { product: result.products.find((product) => product.id === id) || null, error: result.error };
}
