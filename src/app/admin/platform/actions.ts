"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function enterTenantWorkspace(formData: FormData) {
  const viewer = await getViewer();
  const organizationId = String(formData.get("organizationId") || "");
  if (viewer?.role !== "platform_owner" || !/^[0-9a-f-]{36}$/i.test(organizationId)) throw new Error("Platform administrator access is required.");
  const supabase = await createClient();
  const { data: organization } = await supabase.from("organizations").select("id").eq("id", organizationId).eq("status", "active").maybeSingle();
  if (!organization) throw new Error("This tenant is not available.");
  const { error } = await supabase.from("platform_workspace_contexts").upsert({ user_id: viewer.id, active_organization_id: organization.id, updated_at: new Date().toISOString() });
  if (error) throw new Error("The active workspace could not be changed.");
  revalidatePath("/");
  redirect("/dashboard");
}

export async function updateIndustryTemplateVisibility(formData: FormData) {
  const viewer = await getViewer();
  const templateId = String(formData.get("templateId") || "");
  if (viewer?.role !== "platform_owner" || !/^[0-9a-f-]{36}$/i.test(templateId)) throw new Error("Platform administrator access is required.");
  const isInternalOnly = formData.get("isInternalOnly") === "on";
  const values = {
    is_enabled: formData.get("isEnabled") === "on",
    is_internal_only: isInternalOnly,
    is_public_demo_visible: !isInternalOnly && formData.get("isPublicDemoVisible") === "on",
    is_available_during_signup: !isInternalOnly && formData.get("isAvailableDuringSignup") === "on",
    updated_at: new Date().toISOString(),
  };
  const { error } = await (await createClient()).from("industry_templates").update(values).eq("id", templateId);
  if (error) throw new Error("The industry template settings could not be saved.");
  revalidatePath("/admin/platform");
}

export async function saveTemplateProduct(formData: FormData) {
  const viewer = await getViewer();
  const templateId = String(formData.get("templateId") || "");
  const productId = String(formData.get("productId") || "");
  const name = String(formData.get("name") || "").trim().slice(0, 160);
  if (viewer?.role !== "platform_owner" || !/^[0-9a-f-]{36}$/i.test(templateId) || !name) throw new Error("Platform administrator access is required.");
  const rawModelYear = String(formData.get("modelYear") || "").trim();
  const modelYear = rawModelYear ? Number(rawModelYear) : null;
  if (rawModelYear && (!Number.isInteger(Number(rawModelYear)) || Number(rawModelYear) < 1900 || Number(rawModelYear) > 2200)) throw new Error("Enter a valid model year.");
  const rvSpecificationFields = ["shippingWeight", "carryingCapacity", "hitchWeight", "length", "height", "tireSize", "freshWater", "grayWater", "wasteWater", "sleepingCapacity", "numberOfPropaneTanks", "lpgCapacity", "refrigeratorSize"] as const;
  const specifications = Object.fromEntries(rvSpecificationFields.map((field) => [field, String(formData.get(field) || "").trim().slice(0, 120)]).filter(([, value]) => value));
  const values = { industry_template_id: templateId, family_name: String(formData.get("familyName") || "Starter Products").trim().slice(0, 120), name, model: String(formData.get("model") || "").trim().slice(0, 120), model_year: modelYear, model_variant: String(formData.get("modelVariant") || "").trim().slice(0, 120), specifications, description: String(formData.get("description") || "").trim().slice(0, 2000), base_price_cents: Math.max(0, Number(formData.get("basePriceCents") || 0)), range_text: String(formData.get("rangeText") || "").trim().slice(0, 120), seats_text: String(formData.get("seatsText") || "").trim().slice(0, 120), powertrain_text: String(formData.get("powertrainText") || "").trim().slice(0, 120), product_type: formData.get("productType") === "competitor_product" ? "competitor_product" : "our_product", manufacturer: String(formData.get("manufacturer") || "").trim().slice(0, 120), product_category: String(formData.get("productCategory") || "").trim().slice(0, 120), updated_at: new Date().toISOString() };
  const supabase = await createClient();
  const query = productId && /^[0-9a-f-]{36}$/i.test(productId) ? supabase.from("industry_template_products").update(values).eq("id", productId).eq("industry_template_id", templateId) : supabase.from("industry_template_products").insert(values);
  const { error } = await query;
  if (error) throw new Error("The starter product could not be saved.");
  revalidatePath(`/admin/platform/templates/${templateId}`);
}

export async function saveTemplateDetails(formData: FormData) {
  const viewer = await getViewer();
  const templateId = String(formData.get("templateId") || "");
  if (viewer?.role !== "platform_owner" || !/^[0-9a-f-]{36}$/i.test(templateId)) throw new Error("Platform administrator access is required.");
  const { data: existing } = await (await createClient()).from("industry_templates").select("starter_configuration").eq("id", templateId).maybeSingle();
  const current = (existing?.starter_configuration as Record<string, unknown> | null) || {};
  const terminology = { ...((current.terminology as Record<string, string> | undefined) || {}), product: String(formData.get("productTerm") || "Product / Service").trim().slice(0, 80) };
  const starter_configuration = { ...current, terminology, assistantInstructions: String(formData.get("assistantInstructions") || "").trim().slice(0, 4000) };
  const { error } = await (await createClient()).from("industry_templates").update({ starter_configuration, updated_at: new Date().toISOString() }).eq("id", templateId);
  if (error) throw new Error("The template could not be saved.");
  revalidatePath(`/admin/platform/templates/${templateId}`);
}

export async function updateTenant(formData: FormData) {
  const viewer = await getViewer();
  const tenantId = String(formData.get("tenantId") || "");
  const name = String(formData.get("name") || "").trim().slice(0, 120);
  const subscriptionStatus = String(formData.get("subscriptionStatus") || "");
  const status = String(formData.get("status") || "");
  const templateId = String(formData.get("templateId") || "");
  const permittedSubscriptionStatuses = ["trial", "active", "past_due", "suspended", "cancelled"];
  const permittedTenantStatuses = ["active", "inactive"];

  if (
    viewer?.role !== "platform_owner" ||
    !/^[0-9a-f-]{36}$/i.test(tenantId) ||
    !/^[0-9a-f-]{36}$/i.test(templateId) ||
    name.length < 2 ||
    !permittedSubscriptionStatuses.includes(subscriptionStatus) ||
    !permittedTenantStatuses.includes(status)
  ) {
    throw new Error("Enter a valid tenant name and status.");
  }

  const supabase = await createClient();
  const { data: template } = await supabase.from("industry_templates").select("id,is_enabled").eq("id", templateId).maybeSingle();
  if (!template?.is_enabled) throw new Error("Choose an enabled industry template.");

  const { error } = await supabase
    .from("organizations")
    .update({ name, status, subscription_status: subscriptionStatus, industry_template_id: template.id })
    .eq("id", tenantId);

  if (error) throw new Error("The tenant could not be updated.");
  revalidatePath("/admin/platform");
}

export async function deleteEmptyTenant(formData: FormData) {
  const viewer = await getViewer();
  const tenantId = String(formData.get("tenantId") || "");
  const confirmation = String(formData.get("confirmation") || "").trim();
  if (viewer?.role !== "platform_owner" || !/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error("Platform administrator access is required.");
  const supabase = await createClient();
  const { data: tenant } = await supabase.from("organizations").select("id,name,slug,is_internal_demo").eq("id", tenantId).maybeSingle();
  if (!tenant || tenant.slug === "bgc-dealerships" || confirmation !== tenant.name) throw new Error("Type the exact tenant name to confirm deletion.");
  const [{ count: members }, { count: products }, { count: documents }] = await Promise.all([
    supabase.from("organization_memberships").select("id", { count: "exact", head: true }).eq("organization_id", tenant.id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("organization_id", tenant.id),
    supabase.from("knowledge_documents").select("id", { count: "exact", head: true }).eq("organization_id", tenant.id),
  ]);
  if ((members || 0) + (products || 0) + (documents || 0) > 0) throw new Error("This tenant has members or business data. Archive it instead to preserve its records.");
  const { error } = await supabase.from("organizations").delete().eq("id", tenant.id);
  if (error) throw new Error("The empty tenant could not be deleted.");
  revalidatePath("/admin/platform");
}

export async function createTenant(formData: FormData) {
  const viewer = await getViewer();
  const name = String(formData.get("name") || "").trim().slice(0, 120);
  const templateId = String(formData.get("templateId") || "");
  const slug = slugify(name);
  if (viewer?.role !== "platform_owner" || name.length < 2 || !slug || !/^[0-9a-f-]{36}$/i.test(templateId)) throw new Error("Enter a tenant name and choose an industry template.");
  const supabase = await createClient();
  const { data: template } = await supabase.from("industry_templates").select("id,name,is_enabled,starter_configuration").eq("id", templateId).maybeSingle();
  if (!template?.is_enabled) throw new Error("Choose an enabled industry template.");
  const { data: tenant, error } = await supabase.from("organizations").insert({ name, slug, status: "active", industry_template_id: template.id, subscription_status: "trial", is_internal_demo: formData.get("isInternalDemo") === "on" }).select("id").single();
  if (error || !tenant) throw new Error(error?.code === "23505" ? "A tenant with that name already exists." : "The tenant could not be created.");
  const { data: location, error: locationError } = await supabase.from("locations").insert({ organization_id: tenant.id, name: "Main Location", is_active: true }).select("id").single();
  if (locationError || !location) throw new Error("The tenant was created, but its starter location could not be saved.");
  const terminology = (template.starter_configuration as { terminology?: { product?: string } } | null)?.terminology;
  const assistantInstructions = terminology?.product ? `This workspace uses ${template.name} terminology. Refer to products as ${terminology.product}.` : "";
  const { error: settingsError } = await supabase.from("organization_settings").insert({ organization_id: tenant.id, display_name: name, primary_color: "#0B5CFF", default_location_id: location.id, assistant_instructions: assistantInstructions });
  if (settingsError) throw new Error("The tenant was created, but its starter settings could not be saved.");
  const { data: starterProducts, error: starterProductsError } = await supabase.from("industry_template_products").select("family_name,name,model,model_year,model_variant,specifications,description,base_price_cents,range_text,seats_text,powertrain_text,product_type,manufacturer,product_category,sort_order").eq("industry_template_id", template.id).order("sort_order");
  if (starterProductsError) throw new Error("The tenant was created, but its template products could not be loaded.");
  const families = new Map<string, string>();
  for (const starter of starterProducts || []) {
    const familyName = starter.family_name || "Starter Products";
    let familyId = families.get(familyName);
    if (!familyId) {
      const familySlug = `${slugify(familyName)}-${tenant.id.slice(0, 8)}`;
      const { data: family, error: familyError } = await supabase.from("product_families").insert({ organization_id: tenant.id, name: familyName, slug: familySlug, description: "Created from an industry template." }).select("id").single();
      if (familyError || !family) throw new Error("The tenant was created, but a starter product family could not be saved.");
      familyId = family.id!;
      families.set(familyName, family.id!);
    }
    const productName = starter.name || "Starter Product";
    const productSlug = `${slugify(productName)}-${tenant.id.slice(0, 8)}`;
    const voltage = ["48V", "72V"].includes(starter.powertrain_text) ? starter.powertrain_text : "";
    const { error: productError } = await supabase.from("products").insert({ organization_id: tenant.id, family_id: familyId, name: productName, slug: productSlug, model: starter.model || "", model_year: starter.model_year, model_variant: starter.model_variant || "", specifications: starter.specifications || {}, description: starter.description || "", base_price_cents: starter.base_price_cents || 0, range_text: starter.range_text || "", seats_text: starter.seats_text || "", powertrain_text: voltage, product_type: starter.product_type || "our_product", manufacturer: starter.manufacturer || "", brand: starter.manufacturer || "", product_category: starter.product_category || "", status: "published", review_status: "approved", sort_order: starter.sort_order || 0 });
    if (productError) throw new Error("The tenant was created, but a starter product could not be saved.");
  }
  revalidatePath("/admin/platform");
}
