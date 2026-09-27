import { MessageGenerator } from "@/components/message-generator";
import { getViewer } from "@/lib/auth/viewer";
import { getTenantProducts } from "@/lib/products/data";

export default async function Text() {
  const viewer = await getViewer();
  const result = await getTenantProducts();
  const products = result.products.map((product) => `${product.name}${product.model ? ` — ${product.model}` : ""}`);
  return <MessageGenerator kind="text" productOptions={products} salespersonName={viewer?.fullName} dealershipName={viewer?.organizationName}/>;
}
