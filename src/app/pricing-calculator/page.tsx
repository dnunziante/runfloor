import { AppShell } from "@/components/app-shell";
import { CombinedCalculator } from "@/components/combined-calculator";
import { getViewer } from "@/lib/auth/viewer";
import { getTenantProductFamilies, getTenantProducts } from "@/lib/products/data";
import { getOrganizationLocations } from "@/lib/locations";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";

const addOnFamilySlugs = new Set(["accessories", "warranties"]);

export default async function PricingCalculatorPage() {
  const [result, familyResult, locationResult, viewer] = await Promise.all([getTenantProducts(), getTenantProductFamilies(), getOrganizationLocations(), getViewer()]);
  const isRv = viewer ? await getViewerIndustryTemplateKey(viewer) === "rv" : false;
  const addOnFamilyIds = new Set(familyResult.families.filter((family) => addOnFamilySlugs.has(family.slug)).map((family) => family.id));
  const accessoryFamilyIds = new Set(familyResult.families.filter((family) => family.slug === "accessories").map((family) => family.id));
  const warrantyFamilyIds = new Set(familyResult.families.filter((family) => family.slug === "warranties").map((family) => family.id));
  const vehicles = result.products
    .filter((product) => product.productType !== "competitor_product" && (!product.familyId || !addOnFamilyIds.has(product.familyId)))
    .sort((first, second) => {
      const nameOrder = first.name.localeCompare(second.name, undefined, { sensitivity: "base", numeric: true });
      if (nameOrder) return nameOrder;
      const priceOrder = first.price - second.price;
      return priceOrder || first.model.localeCompare(second.model, undefined, { sensitivity: "base", numeric: true });
    });
  const accessories = result.products.filter((product) => product.familyId && accessoryFamilyIds.has(product.familyId));
  const warranties = result.products.filter((product) => product.familyId && warrantyFamilyIds.has(product.familyId));
  return <AppShell title="Quote & Financing Calculator" industry={isRv ? "rv" : undefined}>
    {result.error || familyResult.error || locationResult.error ? <div className="card error-card"><h2>Calculator unavailable</h2><p>{result.error || familyResult.error || locationResult.error}</p></div> : <CombinedCalculator vehicles={vehicles} accessories={accessories} warranties={warranties} locations={locationResult.locations} isRv={isRv}/>}
  </AppShell>;
}
