import { MessageGenerator } from "@/components/message-generator";
import { getViewer } from "@/lib/auth/viewer";
import { getViewerIndustryTemplateKey } from "@/lib/organizations/industry";
import { getTenantProducts } from "@/lib/products/data";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const [{ kind }, viewer, result] = await Promise.all([searchParams, getViewer(), getTenantProducts()]);
  const templateKey = viewer ? await getViewerIndustryTemplateKey(viewer) : null;
  const products = result.products.map((product) => `${product.name}${product.model ? ` — ${product.model}` : ""}`);
  return <MessageGenerator initialKind={kind === "text" ? "text" : "email"} productOptions={products} salespersonName={viewer?.fullName} dealershipName={viewer?.organizationName} industry={templateKey === "rv" ? "rv" : "golf-cart"}/>;
}
