import { MessageGenerator } from "@/components/message-generator";
import { getViewer } from "@/lib/auth/viewer";
import { getTenantProducts } from "@/lib/products/data";

export default async function Email() {
  const viewer = await getViewer();
  const result = await getTenantProducts();
  const products = result.products.map((product) => `${product.name}${product.model ? ` — ${product.model}` : ""}`);
  return <MessageGenerator kind="email" productOptions={products} salespersonName={viewer?.fullName} dealershipName={viewer?.organizationName}/>;
}
