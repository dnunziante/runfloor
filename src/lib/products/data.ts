import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { isFreeSolo } from "@/lib/plans/policy";

import { getViewer } from "@/lib/auth/viewer";
import { demoProductFamilies as demoFamilies, demoProducts } from "@/lib/demo/catalog";
import { isLocalDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

type TemplateProductRow = {
  id: string; family_name: string; name: string; model: string; model_year: number | null;
  model_variant: string; specifications: Record<string, string | number | boolean | null> | null; description: string;
  base_price_cents: number; range_text: string; seats_text: string; powertrain_text: string;
  product_type: ProductType; manufacturer: string; product_category: string; sort_order: number;
};

const templateFamilyId = (name: string) => `demo-rv-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "products"}`;

function templateDTOs(rows: TemplateProductRow[]): ProductDTO[] { return rows.map((row) => ({ id: row.id, familyId: templateFamilyId(row.family_name), name: row.name, slug: `rv-${row.id}`, model: row.model, brand: String(row.specifications?.brand || row.manufacturer), manufacturer: row.manufacturer, modelYear: row.model_year, modelVariant: row.model_variant, productType: row.product_type, productCategory: row.product_category, specifications: row.specifications ?? {}, description: row.description, price: row.base_price_cents / 100, range: row.range_text, seats: row.seats_text, powertrain: row.powertrain_text, dimensions: "", runningDistance: "", turningRadius: "", maxLoadCapacity: "", sortOrder: row.sort_order, highlights: [], color: "orange", imageUrl: null, imageUrls: [], imagePaths: [], salesGuide: emptySalesGuide, status: "Published" })); }

async function getPublicRvTemplateProducts(): Promise<ProductResult> {
  const admin = createAdminClient();
  const { data: template, error: templateError } = await admin.from("industry_templates").select("id").eq("template_key", "rv").eq("is_enabled", true).maybeSingle();
  if (templateError || !template) return { products: [], source: "supabase", error: "The RV demo catalog is unavailable." };
  const { data, error } = await admin.from("industry_template_products").select("id,family_name,name,model,model_year,model_variant,specifications,description,base_price_cents,range_text,seats_text,powertrain_text,product_type,manufacturer,product_category,sort_order").eq("industry_template_id", template.id).order("sort_order").order("name");
  if (error) return { products: [], source: "supabase", error: "The RV demo catalog is unavailable." };
  return { source: "supabase", products: templateDTOs((data ?? []) as TemplateProductRow[]) };
}

async function getPublicRvTemplateFamilies(): Promise<ProductFamilyResult> {
  const products = await getPublicRvTemplateProducts();
  if (products.error) return { families: [], source: products.source, error: products.error };
  const groups = new Map<string, number>();
  for (const product of products.products) { const name = product.familyId?.replace(/^demo-rv-/, "").replace(/-/g, " ") || "RVs"; groups.set(name, (groups.get(name) ?? 0) + 1); }
  return { source: "supabase", families: [...groups].map(([name, productCount]) => ({ id: templateFamilyId(name), name: name.replace(/\b\w/g, (letter) => letter.toUpperCase()), slug: templateFamilyId(name).replace(/^demo-rv-/, ""), description: "Explore this RV category in the public RunFloor demo.", imageUrl: null, imagePath: null, productCount })) };
}

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
    specifications: Object.fromEntries(Object.entries(row.specifications || {}).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value) || value === null)) as Record<string, string | number | boolean | null>,
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

const productColumns = "id, family_id, name, slug, model, brand, manufacturer, model_year, model_variant, product_type, product_category, sale_price_cents, specifications, description, base_price_cents, range_text, seats_text, powertrain_text, dimensions, running_distance, turning_radius, max_load_capacity, sort_order, highlights, visual_theme, image_path, image_paths, sales_guide, status";

export async function getApprovedComparisonProducts(organizationId: string, ids: string[]) {
  const db = await createClient();
  const { data, error } = await db.from("products").select(productColumns)
    .eq("organization_id", organizationId).eq("status", "published").eq("review_status", "approved").in("id", ids);
  if (error) throw new Error("Approved catalog products could not be loaded.");
  return ((data ?? []) as ProductRow[]).map(row => toDTO(row));
}

export async function getTenantProducts(options: { includeDrafts?: boolean; familyId?: string } = {}): Promise<ProductResult> {
  const viewer = await getViewer();
  if (isFreeSolo(viewer?.plan)) return getSoloSharedCatalog();
  if (viewer?.demo && !isLocalDemoMode() && isSupabaseConfigured()) {
    const result = await getPublicRvTemplateProducts();
    return options.familyId ? { ...result, products: result.products.filter((product) => product.familyId === options.familyId) } : result;
  }
  if (isLocalDemoMode() || !isSupabaseConfigured()) {
    return { products: options.familyId ? demoProducts.filter((product) => product.familyId === options.familyId) : demoProducts, source: "demo" };
  }

  if (!viewer?.organizationId) {
    return { products: [], source: "supabase", error: "Your account is not assigned to an organization." };
  }

  const supabase = await createClient();
  const pageSize = 1000;
  const rows: ProductRow[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("products")
      .select(productColumns)
      .eq("organization_id", viewer.organizationId)
      .order("sort_order")
      .order("name")
      .order("id")
      .range(from, from + pageSize - 1);

    if (!options.includeDrafts) query = query.eq("status", "published");
    if (options.familyId) query = query.eq("family_id", options.familyId);

    const { data, error } = await query;
    if (error) {
      return { products: [], source: "supabase", error: "Products could not be loaded from the workspace." };
    }

    const page = (data ?? []) as ProductRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
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

export async function getTenantProductFamilies(competitor = false): Promise<ProductFamilyResult> {
  const viewer = await getViewer();
  if (isFreeSolo(viewer?.plan)) return {families:[],source:"supabase"};
  if (viewer?.demo && !isLocalDemoMode() && isSupabaseConfigured()) return competitor ? { families: [], source: "supabase" } : getPublicRvTemplateFamilies();
  if (isLocalDemoMode() || !isSupabaseConfigured()) return { families: competitor ? [] : demoFamilies, source: "demo" };
  if (!viewer?.organizationId) return { families: [], source: "supabase", error: "Your account is not assigned to an organization." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_families")
    .select("id, name, slug, description, image_path, products(count)")
    .eq("organization_id", viewer.organizationId)
    .order("sort_order")
    .order("name");

  if (error) return { families: [], source: "supabase", error: "Product families could not be loaded from the workspace." };
  const rows = (data as ProductFamilyRow[]).filter((row) => row.slug.startsWith("competitor-brand-") === competitor);
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
  const viewer=await getViewer();if(viewer && !viewer.demo && slug.startsWith("rv-")){const shared=await getSoloSharedCatalog({selected:[slug.slice(3)]});return {product:shared.products.find(p=>p.slug===slug)||null,error:shared.error};}
  const result = await getTenantProducts();
  return { product: result.products.find((product) => product.slug === slug) || null, error: result.error };
}

export async function getTenantProductById(id: string) {
  const result = await getTenantProducts({ includeDrafts: true });
  return { product: result.products.find((product) => product.id === id) || null, error: result.error };
}


type CatalogInput = { page?: number; q?: string; brand?: string; rvType?: string; year?: string; selected?: string[]; comparison?: boolean };
export type SharedCatalog = ProductResult & { page: number; hasMore: boolean; brands: string[]; categories: string[]; years: number[] };
const catalogArgs = (input: CatalogInput) => ({page_number: Math.min(1000,Math.max(1,Math.floor(input.page || 1))),search_text:(input.q || "").slice(0,80),selected_ids:(input.selected || []).filter(id=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)).slice(0,3),comparison:!!input.comparison,brand_filter:(input.brand || "").slice(0,120),category_filter:(input.rvType || "").slice(0,120),year_filter:/^\d{4}$/.test(input.year || "") ? Number(input.year) : null});
const cachedCatalog = unstable_cache(async (key: string) => {
 const db=createAdminClient();const result=await db.rpc("solo_shared_catalog",JSON.parse(key));if(result.error)throw new Error("Shared catalog unavailable");return result.data;
},["solo-authorized-rv-catalog-v1"],{revalidate:60});
const readSharedCatalog = cache(async (key: string): Promise<SharedCatalog> => {
 const args=JSON.parse(key);const empty:SharedCatalog={products:[],source:"supabase",page:args.page_number,hasMore:false,brands:[],categories:[],years:[]};
 const viewer=await getViewer();if(!viewer || viewer.demo || !viewer.organizationId)return {...empty,error:"Sign in to an RV workspace to browse the shared catalog."};
 const db=await createClient();let data;
 if(process.env.SUPABASE_SERVICE_ROLE_KEY){const access=await db.rpc("solo_catalog_access");if(access.error)return {...empty,error:"Catalog access is temporarily unavailable. Please try again shortly."};try{data=await cachedCatalog(key);}catch{return {...empty,error:"The authorized shared catalog is unavailable."};}}
 else {const result=await db.rpc("solo_shared_catalog",args);if(result.error)return {...empty,error:"Catalog access is temporarily unavailable. Please try again shortly."};data=result.data;}
 return {...empty,products:templateDTOs(data.products || []),hasMore:!!data.has_more,brands:(data.brands || []).filter(Boolean),categories:(data.categories || []).filter(Boolean),years:data.years || []};
});
export async function getSoloSharedCatalog(input: CatalogInput = {}) {return readSharedCatalog(JSON.stringify(catalogArgs(input)));}
